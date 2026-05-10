import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:camera/camera.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sensors_plus/sensors_plus.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

class FloorPlanScanScreen extends StatefulWidget {
  const FloorPlanScanScreen({super.key});

  @override
  State<FloorPlanScanScreen> createState() => _FloorPlanScanScreenState();
}

class _FloorPlanScanScreenState extends State<FloorPlanScanScreen>
    with SingleTickerProviderStateMixin {
  // ── Camera ──────────────────────────────────────────
  CameraController? _cam;
  bool _camReady = false;

  // ── Gyroscope / heading ─────────────────────────────
  StreamSubscription? _gyroSub;
  double _heading = 0.0;        // radians, cumulative yaw
  DateTime? _lastGyroTime;

  // ── Position & path ────────────────────────────────
  // Vertices in virtual "meter" space; first point is always (0,0)
  final List<Offset> _vertices = [Offset.zero];
  Offset _currentPos = Offset.zero;
  DateTime? _segmentStart;
  double _totalDist = 0.0;

  // ── State ───────────────────────────────────────────
  bool _generating = false;

  // ── Animation (pulse for current-pos dot) ──────────
  late final AnimationController _pulseCtrl;

  static const _walkSpeed = 1.2; // m/s

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);

    _initCamera();
    _startGyro();
    _segmentStart = DateTime.now();
  }

  @override
  void dispose() {
    _cam?.dispose();
    _gyroSub?.cancel();
    _pulseCtrl.dispose();
    super.dispose();
  }

  Future<void> _initCamera() async {
    try {
      final cams = await availableCameras();
      if (cams.isEmpty) return;
      final ctrl = CameraController(cams.first, ResolutionPreset.medium, enableAudio: false);
      await ctrl.initialize();
      if (!mounted) { ctrl.dispose(); return; }
      setState(() { _cam = ctrl; _camReady = true; });
    } catch (e) { debugPrint('[Cam] $e'); }
  }

  void _startGyro() {
    _lastGyroTime = DateTime.now();
    _gyroSub = gyroscopeEvents.listen((event) {
      final now = DateTime.now();
      final dt = _lastGyroTime == null
          ? 0.0
          : now.difference(_lastGyroTime!).inMicroseconds / 1e6;
      _lastGyroTime = now;

      // Portrait mode: Y-axis ≈ vertical world axis → yaw
      // Use whichever axis has larger magnitude as fallback
      final yawRate = event.y.abs() > event.z.abs() ? event.y : event.z;
      _heading += yawRate * dt;

      // Update current position (segment from last vertex)
      final segDt = _segmentStart == null
          ? 0.0
          : now.difference(_segmentStart!).inSeconds.toDouble()
              + now.difference(_segmentStart!).inMilliseconds % 1000 / 1000.0;
      final dist = segDt * _walkSpeed;
      _currentPos = _vertices.last + Offset(sin(_heading) * dist, -cos(_heading) * dist);

      if (mounted) setState(() {});
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  void _recordCorner() {
    HapticFeedback.mediumImpact();
    final now = DateTime.now();
    final segDt = _segmentStart == null ? 0.0
        : now.difference(_segmentStart!).inSeconds.toDouble()
            + now.difference(_segmentStart!).inMilliseconds % 1000 / 1000.0;
    final dist = segDt * _walkSpeed;

    final newVertex = _vertices.last + Offset(sin(_heading) * dist, -cos(_heading) * dist);
    setState(() {
      _totalDist += dist;
      _vertices.add(newVertex);
      _currentPos = newVertex;
      _segmentStart = now;
    });
  }

  Future<void> _completeScan() async {
    if (_vertices.length < 3) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('최소 3개의 꺾기 지점이 필요합니다'),
        backgroundColor: Colors.redAccent,
        behavior: SnackBarBehavior.floating,
      ));
      return;
    }

    setState(() => _generating = true);
    HapticFeedback.heavyImpact();

    try {
      final path = await _renderFloorPlanImage(_vertices);
      if (mounted) Navigator.pop(context, path);
    } catch (e) {
      debugPrint('[Scan] render error: $e');
      if (mounted) {
        setState(() => _generating = false);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('도면 생성 실패. 다시 시도해주세요'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ));
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Floor Plan Image Rendering
  // ─────────────────────────────────────────────────────────────────────────

  Future<String> _renderFloorPlanImage(List<Offset> rawVerts) async {
    const w = 1200.0, h = 800.0;
    final verts = _scaleToCanvas(rawVerts, const Size(w, h), padding: 120);

    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder, Rect.fromLTWH(0, 0, w, h));

    // ── Background ──
    canvas.drawRect(Rect.fromLTWH(0, 0, w, h), Paint()..color = Colors.white);

    // ── Grid ──
    final gridPaint = Paint()..color = const Color(0xFFE2E8F0)..strokeWidth = 1;
    for (double x = 0; x < w; x += 50) canvas.drawLine(Offset(x, 0), Offset(x, h), gridPaint);
    for (double y = 0; y < h; y += 50) canvas.drawLine(Offset(0, y), Offset(w, y), gridPaint);

    // ── Room polygon fill ──
    final poly = Path()..moveTo(verts.first.dx, verts.first.dy);
    for (final v in verts.skip(1)) poly.lineTo(v.dx, v.dy);
    poly.close();

    canvas.drawPath(poly, Paint()..color = const Color(0xFFEFF6FF)..style = PaintingStyle.fill);

    // ── Wall (thick stroke to show wall thickness) ──
    canvas.drawPath(poly, Paint()
      ..color = const Color(0xFF1D4ED8).withOpacity(0.15)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 22
      ..strokeJoin = StrokeJoin.round);

    // ── Wall border ──
    canvas.drawPath(poly, Paint()
      ..color = const Color(0xFF1D4ED8)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeJoin = StrokeJoin.round);

    // ── Wall length labels ──
    for (int i = 0; i < verts.length; i++) {
      final a = verts[i];
      final b = verts[(i + 1) % verts.length];
      final rawA = rawVerts[i];
      final rawB = rawVerts[(i + 1) % rawVerts.length];
      final dist = (rawB - rawA).distance;
      if (dist < 0.2) continue;

      final mid = Offset((a.dx + b.dx) / 2, (a.dy + b.dy) / 2);
      final label = '${dist.toStringAsFixed(1)}m';
      _drawText(canvas, label, mid + const Offset(-24, -26),
          color: const Color(0xFF1E40AF), fontSize: 20, bold: true);
    }

    // ── Corner markers ──
    for (int i = 0; i < verts.length; i++) {
      final v = verts[i];
      canvas.drawCircle(v, 14, Paint()..color = const Color(0xFF1D4ED8));
      canvas.drawCircle(v, 10, Paint()..color = Colors.white);
      _drawText(canvas, '${i + 1}', v + const Offset(-6, -11),
          color: const Color(0xFF1D4ED8), fontSize: 15, bold: true);
    }

    // ── Title ──
    _drawText(canvas, '현장 스캔 도면', const Offset(30, 22),
        color: const Color(0xFF1E3A5F), fontSize: 30, bold: true);
    _drawText(canvas,
        '생성: ${DateTime.now().toString().substring(0, 16)}  ·  꺾기점 ${rawVerts.length}개  ·  총 ${_totalDist.toStringAsFixed(1)}m',
        const Offset(30, 60), color: const Color(0xFF64748B), fontSize: 18);

    final picture = recorder.endRecording();
    final img = await picture.toImage(w.toInt(), h.toInt());
    final bytes = (await img.toByteData(format: ui.ImageByteFormat.png))!.buffer.asUint8List();

    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/fp_scan_${DateTime.now().millisecondsSinceEpoch}.png');
    await file.writeAsBytes(bytes);
    return file.path;
  }

  void _drawText(Canvas canvas, String text, Offset offset, {
    Color color = Colors.black, double fontSize = 16, bool bold = false,
  }) {
    final pb = ui.ParagraphBuilder(ui.ParagraphStyle(textAlign: TextAlign.left))
      ..pushStyle(ui.TextStyle(
        color: color,
        fontSize: fontSize,
        fontWeight: bold ? ui.FontWeight.w700 : ui.FontWeight.normal,
      ))
      ..addText(text);
    final p = pb.build()..layout(const ui.ParagraphConstraints(width: 500));
    canvas.drawParagraph(p, offset);
  }

  List<Offset> _scaleToCanvas(List<Offset> verts, Size canvas, {double padding = 80}) {
    if (verts.length < 2) return [Offset(canvas.width / 2, canvas.height / 2)];

    final xs = verts.map((v) => v.dx).toList();
    final ys = verts.map((v) => v.dy).toList();
    final minX = xs.reduce(min), maxX = xs.reduce(max);
    final minY = ys.reduce(min), maxY = ys.reduce(max);

    final rangeX = (maxX - minX).clamp(0.1, double.infinity);
    final rangeY = (maxY - minY).clamp(0.1, double.infinity);
    final scale = min(
      (canvas.width  - padding * 2) / rangeX,
      (canvas.height - padding * 2) / rangeY,
    );

    final ox = (canvas.width  - rangeX * scale) / 2 - minX * scale;
    final oy = (canvas.height - rangeY * scale) / 2 - minY * scale;

    return verts.map((v) => Offset(v.dx * scale + ox, v.dy * scale + oy)).toList();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build
  // ─────────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async { Navigator.pop(context, null); return false; },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Stack(children: [
          // Camera preview
          if (_camReady && _cam != null)
            Positioned.fill(child: CameraPreview(_cam!))
          else
            Container(color: const Color(0xFF0F172A),
              child: const Center(child: CircularProgressIndicator(color: Colors.white))),

          // Subtle dark overlay
          Positioned.fill(child: Container(color: const Color(0x55000000))),

          // Scan direction guide: 우측 방향 화살표
          Positioned.fill(child: _buildDirectionGuide()),

          // Top info
          _buildTopBar(),

          // Close button
          Positioned(top: 52, right: 16, child: IconButton(
            icon: const Icon(Icons.close, color: Colors.white, size: 30),
            onPressed: () => Navigator.pop(context, null),
          )),

          // Mini-map (bottom-right)
          Positioned(right: 16, bottom: 220, child: _buildMiniMap()),

          // Bottom control panel
          Positioned(bottom: 0, left: 0, right: 0, child: _buildBottomPanel()),

          // Generating overlay
          if (_generating)
            Positioned.fill(child: Container(
              color: const Color(0xCC000000),
              child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                CircularProgressIndicator(color: Color(0xFF14B8A6), strokeWidth: 3),
                SizedBox(height: 20),
                Text('도면 생성 중...', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900)),
                SizedBox(height: 8),
                Text('잠시만 기다려 주세요', style: TextStyle(color: Color(0x8AFFFFFF), fontSize: 15)),
              ]),
            )),
        ]),
      ),
    );
  }

  Widget _buildTopBar() {
    return Positioned(top: 0, left: 0, right: 0, child: Container(
      padding: const EdgeInsets.fromLTRB(20, 56, 60, 20),
      decoration: const BoxDecoration(gradient: LinearGradient(
        begin: Alignment.topCenter, end: Alignment.bottomCenter,
        colors: [Colors.black87, Colors.transparent],
      )),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Row(children: [
          Icon(Icons.radar, color: Color(0xFF7DD3FC), size: 18),
          SizedBox(width: 6),
          Text('현장 스캔 모드', style: TextStyle(color: Color(0xFF7DD3FC), fontSize: 13, fontWeight: FontWeight.bold, letterSpacing: 1.5)),
        ]),
        const SizedBox(height: 6),
        const Text(
          '시계방향으로 벽을 따라 걸으세요\n모서리마다 [꺾기] 버튼을 누르세요',
          style: TextStyle(color: Colors.white, fontSize: 15, height: 1.5),
        ),
      ]),
    ));
  }

  Widget _buildDirectionGuide() {
    return Center(child: AnimatedBuilder(
      animation: _pulseCtrl,
      builder: (_, __) => Opacity(
        opacity: 0.15 + _pulseCtrl.value * 0.1,
        child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          SizedBox(width: 40),
          Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 80),
        ]),
      ),
    ));
  }

  Widget _buildMiniMap() {
    return Container(
      width: 180, height: 150,
      decoration: BoxDecoration(
        color: const Color(0xDD0F172A),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF14B8A6), width: 1.5),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(13),
        child: Stack(children: [
          Positioned.fill(child: CustomPaint(
            painter: _MiniMapPainter(
              vertices: _vertices,
              currentPos: _currentPos,
              heading: _heading,
              pulse: _pulseCtrl.value,
            ),
          )),
          const Positioned(top: 6, left: 8,
            child: Text('미니맵', style: TextStyle(color: Color(0xFF7DD3FC), fontSize: 10, fontWeight: FontWeight.bold))),
          Positioned(bottom: 5, right: 8,
            child: Text('${_vertices.length - 1}꺾기',
                style: const TextStyle(color: Color(0xFF14B8A6), fontSize: 10, fontWeight: FontWeight.bold))),
        ]),
      ),
    );
  }

  Widget _buildBottomPanel() {
    final corners = _vertices.length - 1;
    final canComplete = _vertices.length >= 3;

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 36),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.bottomCenter, end: Alignment.topCenter,
          colors: [Colors.black87, Colors.black54, Colors.transparent],
        ),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        // Stats row
        Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
          _stat(Icons.turn_right_rounded, '$corners개', '꺾기점'),
          _stat(Icons.straighten, '${_totalDist.toStringAsFixed(1)}m', '이동거리'),
          _stat(Icons.navigation, '${(_heading * 180 / pi % 360).abs().toStringAsFixed(0)}°', '방향'),
        ]),
        const SizedBox(height: 16),

        // Action buttons
        Row(children: [
          // 꺾기 button (prominent, blue)
          Expanded(
            flex: 2,
            child: SizedBox(
              height: 72,
              child: ElevatedButton.icon(
                onPressed: _recordCorner,
                icon: const Icon(Icons.turn_right_rounded, size: 30),
                label: const Text('꺾 기', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, letterSpacing: 2)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  foregroundColor: Colors.white,
                  elevation: 6,
                  shadowColor: const Color(0xFF2563EB),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),

          // 완료 button
          Expanded(
            child: SizedBox(
              height: 72,
              child: ElevatedButton(
                onPressed: canComplete ? _completeScan : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: canComplete ? const Color(0xFF14B8A6) : const Color(0xFF334155),
                  foregroundColor: Colors.white,
                  elevation: canComplete ? 4 : 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.check_circle_outline, size: 26, color: canComplete ? Colors.white : Colors.white38),
                  const SizedBox(height: 2),
                  Text('스캔\n완료', textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold,
                          color: canComplete ? Colors.white : Colors.white38)),
                ]),
              ),
            ),
          ),
        ]),

        const SizedBox(height: 10),
        Text(
          canComplete
              ? '출발점으로 돌아왔으면 [스캔 완료]를 누르세요'
              : '꺾기점 ${3 - _vertices.length}개 더 필요 (현재 $corners개)',
          style: TextStyle(
            color: canComplete ? const Color(0xFF14B8A6) : const Color(0x8AFFFFFF),
            fontSize: 13, fontWeight: canComplete ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ]),
    );
  }

  Widget _stat(IconData icon, String value, String label) {
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, color: const Color(0xFF7DD3FC), size: 22),
      const SizedBox(height: 3),
      Text(value, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
      Text(label, style: const TextStyle(color: Color(0x8AFFFFFF), fontSize: 11)),
    ]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini-Map Painter
// ─────────────────────────────────────────────────────────────────────────────

class _MiniMapPainter extends CustomPainter {
  final List<Offset> vertices;
  final Offset currentPos;
  final double heading;
  final double pulse;

  const _MiniMapPainter({
    required this.vertices,
    required this.currentPos,
    required this.heading,
    required this.pulse,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final allPts = [...vertices, currentPos];
    if (allPts.length < 2) {
      // Just draw starting dot
      canvas.drawCircle(Offset(size.width / 2, size.height / 2), 5,
          Paint()..color = const Color(0xFF14B8A6));
      return;
    }

    // Normalize to canvas
    final xs = allPts.map((v) => v.dx).toList();
    final ys = allPts.map((v) => v.dy).toList();
    final minX = xs.reduce(min), maxX = xs.reduce(max);
    final minY = ys.reduce(min), maxY = ys.reduce(max);
    const pad = 24.0;
    final rx = (maxX - minX).clamp(0.1, double.infinity);
    final ry = (maxY - minY).clamp(0.1, double.infinity);
    final scale = min((size.width - pad * 2) / rx, (size.height - pad * 2) / ry);
    final ox = (size.width  - rx * scale) / 2 - minX * scale;
    final oy = (size.height - ry * scale) / 2 - minY * scale;

    Offset c(Offset v) => Offset(v.dx * scale + ox, v.dy * scale + oy);

    // Completed polygon fill
    if (vertices.length >= 3) {
      final poly = Path()..moveTo(c(vertices.first).dx, c(vertices.first).dy);
      for (final v in vertices.skip(1)) poly.lineTo(c(v).dx, c(v).dy);
      poly.close();
      canvas.drawPath(poly, Paint()..color = const Color(0x2214B8A6)..style = PaintingStyle.fill);
    }

    // Walked path
    final linePaint = Paint()
      ..color = const Color(0xFF14B8A6)
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke
      ..strokeJoin = StrokeJoin.round;

    final path = Path()..moveTo(c(vertices.first).dx, c(vertices.first).dy);
    for (final v in vertices.skip(1)) path.lineTo(c(v).dx, c(v).dy);
    path.lineTo(c(currentPos).dx, c(currentPos).dy);
    canvas.drawPath(path, linePaint);

    // Corner dots
    for (int i = 0; i < vertices.length; i++) {
      final pt = c(vertices[i]);
      canvas.drawCircle(pt, i == 0 ? 5 : 3,
          Paint()..color = i == 0 ? Colors.white : const Color(0xFF14B8A6));
    }

    // Current position arrow (pulsing)
    final cur = c(currentPos);
    canvas.save();
    canvas.translate(cur.dx, cur.dy);
    canvas.rotate(heading);

    final arrowSize = 8.0 + pulse * 2;
    final arrowPath = Path()
      ..moveTo(0, -arrowSize)
      ..lineTo(-arrowSize * 0.6, arrowSize * 0.5)
      ..lineTo(0, 0)
      ..lineTo(arrowSize * 0.6, arrowSize * 0.5)
      ..close();

    canvas.drawPath(arrowPath, Paint()..color = Colors.white..style = PaintingStyle.fill);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_MiniMapPainter old) => true;
}
