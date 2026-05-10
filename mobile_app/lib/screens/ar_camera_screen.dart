import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:camera/camera.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:screen_brightness/screen_brightness.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:sensors_plus/sensors_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:http/http.dart' as http;
import 'package:geocoding/geocoding.dart';
import 'package:path_provider/path_provider.dart';
import '../services/offline_sync_service.dart';
import '../services/watermark_service.dart';

const double kBtnH   = 72.0;
const double kCamBtn = 104.0;
const double kIconSz = 32.0;
const double kFabSz  = 66.0;

// ─────────────────────────────────────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────────────────────────────────────

class WorkSpot {
  final String id;
  final String name;
  // Local paths (current session)
  String? beforePhotoPath;
  String? duringPhotoPath;
  String? afterPhotoPath;
  // Server URLs (loaded from Firestore or uploaded)
  String? beforeUrl;
  String? duringUrl;
  String? afterUrl;
  double? lat;
  double? lng;
  final DateTime createdAt;
  // 작업 소요시간 추적
  DateTime? startedAt;    // 작업전 사진 확정 시각
  DateTime? completedAt;  // 작업후 사진 확정 시각
  // 현장 메모
  String?   note;
  // 추가 작업 사진
  List<_ExtraPhoto> extraPhotos = [];

  WorkSpot({required this.id, required this.name}) : createdAt = DateTime.now();

  Duration? get workDuration =>
      (startedAt != null && completedAt != null)
          ? completedAt!.difference(startedAt!) : null;

  String? get durationLabel {
    final d = workDuration;
    if (d == null) return null;
    if (d.inHours > 0) return '${d.inHours}시간 ${d.inMinutes.remainder(60)}분';
    if (d.inMinutes > 0) return '${d.inMinutes}분';
    return '${d.inSeconds}초';
  }

  bool get hasBeforePhoto => beforePhotoPath != null || beforeUrl != null;
  bool get hasDuringPhoto => duringPhotoPath != null || duringUrl != null;
  bool get hasAfterPhoto  => afterPhotoPath  != null || afterUrl  != null;
  bool get isComplete => hasBeforePhoto && hasDuringPhoto && hasAfterPhoto;
  bool isCompleteFor(String mode) =>
      mode == 'ba' ? hasBeforePhoto && hasAfterPhoto : isComplete;

  int get photoCount {
    int c = 0;
    if (hasBeforePhoto) c++;
    if (hasDuringPhoto) c++;
    if (hasAfterPhoto)  c++;
    return c;
  }

  String? pathFor(_Session s) {
    if (s == _Session.before) return beforePhotoPath;
    if (s == _Session.during) return duringPhotoPath;
    return afterPhotoPath;
  }

  String? urlFor(_Session s) {
    if (s == _Session.before) return beforeUrl;
    if (s == _Session.during) return duringUrl;
    return afterUrl;
  }

  bool hasPhotoFor(_Session s) {
    if (s == _Session.before) return hasBeforePhoto;
    if (s == _Session.during) return hasDuringPhoto;
    return hasAfterPhoto;
  }

  void setPath(_Session s, String p) {
    if (s == _Session.before)      beforePhotoPath = p;
    else if (s == _Session.during) duringPhotoPath = p;
    else                           afterPhotoPath  = p;
  }

  void setUrl(_Session s, String url) {
    if (s == _Session.before)      beforeUrl = url;
    else if (s == _Session.during) duringUrl = url;
    else                           afterUrl  = url;
  }

  static WorkSpot fromFirestore(String id, Map<String, dynamic> data) {
    final spot = WorkSpot(id: id, name: data['name'] ?? id);
    spot.lat      = (data['lat'] as num?)?.toDouble();
    spot.lng      = (data['lng'] as num?)?.toDouble();
    spot.beforeUrl   = data['beforeUrl']   as String?;
    spot.duringUrl   = data['duringUrl']   as String?;
    spot.afterUrl    = data['afterUrl']    as String?;
    spot.note        = data['note']        as String?;
    if (data['startedAt']   != null) spot.startedAt   = DateTime.fromMillisecondsSinceEpoch((data['startedAt']   as num).toInt());
    if (data['completedAt'] != null) spot.completedAt = DateTime.fromMillisecondsSinceEpoch((data['completedAt'] as num).toInt());
    // 이 기기에 파일이 존재하면 로컬 경로 복원
    void restorePath(String key, void Function(String) setter) {
      final p = data[key] as String?;
      if (p != null && File(p).existsSync()) setter(p);
    }
    restorePath('beforeLocalPath', (p) => spot.beforePhotoPath = p);
    restorePath('duringLocalPath', (p) => spot.duringPhotoPath = p);
    restorePath('afterLocalPath',  (p) => spot.afterPhotoPath  = p);
    final extras = data['extraPhotos'] as List<dynamic>? ?? [];
    spot.extraPhotos = extras
        .map((e) => _ExtraPhoto.fromMap(Map<String, dynamic>.from(e as Map)))
        .toList();
    return spot;
  }

  Map<String, dynamic> toFirestoreMap() => {
    'name': name, 'lat': lat, 'lng': lng,
    'beforeUrl': beforeUrl, 'duringUrl': duringUrl, 'afterUrl': afterUrl,
    // 로컬 경로도 저장 — 앱 재시작 후 URL 없어도 파일 복원 가능
    'beforeLocalPath': beforePhotoPath,
    'duringLocalPath': duringPhotoPath,
    'afterLocalPath':  afterPhotoPath,
    'startedAt'      : startedAt?.millisecondsSinceEpoch,
    'completedAt'    : completedAt?.millisecondsSinceEpoch,
    'note'           : note,
    'extraPhotos'    : extraPhotos.map((e) => e.toMap()).toList(),
    'updatedAt'      : FieldValue.serverTimestamp(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Extra photo model — unlimited additional work photos per spot
// ─────────────────────────────────────────────────────────────────────────────

class _ExtraPhoto {
  final String id;
  String? localPath;
  String? url;
  final DateTime capturedAt;
  // UI-only state (not persisted)
  bool _uploading = false;
  bool _failed    = false;

  _ExtraPhoto({required this.id, this.localPath, this.url, DateTime? capturedAt})
      : capturedAt = capturedAt ?? DateTime.now();

  Map<String, dynamic> toMap() => {
    'id': id,
    'localPath': localPath,
    'url': url,
    'capturedAt': capturedAt.millisecondsSinceEpoch,
  };

  static _ExtraPhoto fromMap(Map<String, dynamic> m) {
    final ep = _ExtraPhoto(
      id: m['id'] as String? ?? 'extra_${DateTime.now().millisecondsSinceEpoch}',
      url: m['url'] as String?,
      capturedAt: m['capturedAt'] != null
          ? DateTime.fromMillisecondsSinceEpoch((m['capturedAt'] as num).toInt())
          : null,
    );
    final p = m['localPath'] as String?;
    if (p != null && File(p).existsSync()) ep.localPath = p;
    return ep;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

enum _Mode { list, review, approval, complete }
enum _Session { before, during, after }

extension _Sx on _Session {
  String get label => const ['작업 전', '작업 중', '작업 후'][index];
  Color  get color => const [Color(0xFF2563EB), Color(0xFFF59E0B), Color(0xFF14B8A6)][index];
}

// ─────────────────────────────────────────────────────────────────────────────
// Widget
// ─────────────────────────────────────────────────────────────────────────────

class ARCameraScreen extends StatefulWidget {
  final String jobId;
  final String jobName;
  final double jobLat;
  final double jobLng;
  /// 'bda' = 전/중/후 (3단계), 'ba' = 전/후 (2단계)
  final String photoMode;

  const ARCameraScreen({
    super.key,
    required this.jobId,
    required this.jobName,
    this.jobLat = 37.395,
    this.jobLng = 127.111,
    this.photoMode = 'bda',
  });

  @override
  State<ARCameraScreen> createState() => _ARCameraScreenState();
}

class _ARCameraScreenState extends State<ARCameraScreen> with WidgetsBindingObserver {
  // ── Mode / session
  _Mode    _mode    = _Mode.list;
  _Session _session = _Session.before;

  // ── Spots
  final List<WorkSpot> _spots = [];
  int       _spotCounter = 0;
  WorkSpot? _targetSpot;
  bool      _loadingSpots = true;

  // ── Filter tab
  String _filterTab = 'all';

  // ── Capture
  String?    _pendingPath;
  Uint8List? _pendingBytes;
  bool       _checking = false;

  // ── Weather
  String _weatherText    = '';
  bool   _weatherLoading = false;

  // ── GPS matching
  bool _matchingGps = false;

  // ── Current position for proximity sort
  Position? _currentPos;

  // ── Approval
  String? _approvalCode;
  bool    _approvalOffline = false;
  bool    _approvalHandled = false;
  final   _codeCtrl = TextEditingController();

  // ── Photo mode: 'bda' = 전/중/후, 'ba' = 전/후
  late String _photoMode;

  // ── Upload tracking: key = 'spotId_session' or 'spotId_extra_epId'
  final _uploadingKeys = <String>{};
  final _failedKeys    = <String>{};

  // ── TTS
  late final FlutterTts _tts;
  bool _ttsEnabled = true;

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _photoMode = widget.photoMode;
    WidgetsBinding.instance.addObserver(this);
    _initTts();
    _loadSpotsFromFirestore();
    _fetchWeather();
    _fetchCurrentPos();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _tts.stop();
    _codeCtrl.dispose();
    _restoreBrightness();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {}

  Future<void> _fetchWeather() async {
    if (_weatherLoading) return;
    if (mounted) setState(() => _weatherLoading = true);
    try {
      // 권한 확인
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return;

      // 마지막 알려진 위치 먼저 시도 (빠름), 없으면 현재 위치 요청
      Position? pos = await Geolocator.getLastKnownPosition();
      pos ??= await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.low,
      ).timeout(const Duration(seconds: 15));

      // 한국어 지역명: 기기 네이티브 역지오코딩
      String locationName = '';
      try {
        final marks = await placemarkFromCoordinates(pos.latitude, pos.longitude);
        if (marks.isNotEmpty) {
          final m = marks.first;
          locationName = [m.subLocality, m.locality]
              .whereType<String>()
              .where((s) => s.isNotEmpty)
              .join(' ');
        }
      } catch (_) {}

      const apiKey = '6bd6f9a2db4d2d9ca79a98af437be950';
      final url = 'https://api.openweathermap.org/data/2.5/weather'
          '?lat=${pos.latitude}&lon=${pos.longitude}&units=metric&lang=kr&appid=$apiKey';
      final res = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 8));
      if (res.statusCode == 200) {
        final j = jsonDecode(res.body);
        final temp = (j['main']['temp'] as num).round();
        final desc = j['weather'][0]['description'] as String;
        final displayLoc = locationName.isNotEmpty ? locationName : j['name'] as String;
        if (mounted) setState(() => _weatherText = '$displayLoc ${temp}°C $desc');
      }
    } catch (e) {
      debugPrint('[Weather] $e');
    } finally {
      if (mounted) setState(() => _weatherLoading = false);
    }
  }

  Future<void> _fetchCurrentPos() async {
    final pos = await _getGPS();
    if (pos != null && mounted) setState(() => _currentPos = pos);
  }

  Future<void> _initTts() async {
    _tts = FlutterTts();
    await _tts.setLanguage('ko-KR');
    await _tts.setVolume(1.0);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Firestore load / save
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> _loadSpotsFromFirestore() async {
    setState(() => _loadingSpots = true);
    try {
      final doc = await FirebaseFirestore.instance
          .collection('projects').doc(widget.jobId).get();
      if (!mounted) return;
      final data = doc.data() ?? {};
      final arSpots  = data['arSpots']      as Map<String, dynamic>?;
      final counter  = (data['arSpotCounter'] as num?)?.toInt() ?? 0;
      final savedMode = data['photoMode'] as String?;
      if (savedMode != null && mounted) setState(() {
        _photoMode = savedMode;
        if (_photoMode == 'ba' && _filterTab == 'during') _filterTab = 'all';
      });
      if (arSpots != null && arSpots.isNotEmpty) {
        final spots = arSpots.entries
            .map((e) => WorkSpot.fromFirestore(e.key, e.value as Map<String, dynamic>))
            .toList();
        setState(() {
          _spots.clear();
          _spots.addAll(spots);
          _spotCounter = counter;
        });
        if (spots.isNotEmpty) {
          _speak('이전 작업을 불러왔습니다. ${spots.length}개 장소');
          // 로드 후 업로드 안 된 사진 백그라운드 재시도
          Future.delayed(const Duration(seconds: 2), _syncFailedUploads);
        }
      }
    } catch (e) { debugPrint('[Firestore] load: $e'); }
    finally { if (mounted) setState(() => _loadingSpots = false); }
  }

  // 로컬 파일은 있지만 서버 URL 없는 사진을 백그라운드 재업로드
  Future<void> _syncFailedUploads() async {
    for (final spot in List<WorkSpot>.from(_spots)) {
      for (final session in _Session.values) {
        final localPath = spot.pathFor(session);
        final url       = spot.urlFor(session);
        if (localPath == null || url != null) continue;
        final file = File(localPath);
        if (!await file.exists()) continue;
        debugPrint('[Sync] 전/중/후 재업로드: ${spot.name} ${session.label}');
        try {
          final bytes = await file.readAsBytes();
          _uploadAndSave(spot, session, bytes);
        } catch (e) {
          debugPrint('[Sync] 재업로드 오류: $e');
        }
      }
      // 추가사진 중 URL 없는 것도 재업로드
      for (final ep in List<_ExtraPhoto>.from(spot.extraPhotos)) {
        if (ep.url != null || ep.localPath == null) continue;
        final file = File(ep.localPath!);
        if (!await file.exists()) continue;
        debugPrint('[Sync] 추가사진 재업로드: ${spot.name} ${ep.id}');
        try {
          final bytes = await file.readAsBytes();
          _uploadExtraPhotoById(spot, ep, bytes);
        } catch (e) {
          debugPrint('[Sync] 추가사진 재업로드 오류: $e');
        }
      }
    }
  }

  // 추가사진 업로드 (재시도 포함)
  Future<void> _uploadExtraPhotoById(WorkSpot spot, _ExtraPhoto ep, Uint8List bytes) async {
    final key = '${spot.id}_extra_${ep.id}';
    if (_uploadingKeys.contains(key)) return;
    if (mounted) setState(() { _uploadingKeys.add(key); _failedKeys.remove(key); });
    final storagePath = 'ar_photos/${widget.jobId}/${spot.id}/${ep.id}.jpg';
    final url = await _uploadToStorageWithRetry(storagePath, bytes);
    if (mounted) setState(() => _uploadingKeys.remove(key));
    if (url != null) {
      ep.url = url;
      if (mounted) setState(() {});
      try {
        await FirebaseFirestore.instance
            .collection('projects').doc(widget.jobId)
            .set({'arSpots': {spot.id: {'extraPhotos': spot.extraPhotos.map((e) => e.toMap()).toList()}}},
                 SetOptions(merge: true));
      } catch (e) { debugPrint('[ExtraSync] Firestore: $e'); }
    } else {
      if (mounted) setState(() => _failedKeys.add(key));
    }
  }

  Future<void> _saveSpotToFirestore(WorkSpot spot) async {
    try {
      await FirebaseFirestore.instance
          .collection('projects').doc(widget.jobId)
          .set({
        'arSpots': { spot.id: spot.toFirestoreMap() },
        'arSpotCounter': _spotCounter,
      }, SetOptions(merge: true));
    } catch (e) { debugPrint('[Firestore] save: $e'); }
  }

  // 재시도 포함 Storage 업로드 (최대 4회, 지수 백오프, 60초 타임아웃)
  Future<String?> _uploadToStorageWithRetry(String storagePath, Uint8List bytes, {int maxAttempts = 4}) async {
    for (int attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        final storageRef = FirebaseStorage.instance.ref(storagePath);
        final task = storageRef.putData(bytes, SettableMetadata(contentType: 'image/jpeg'));
        // 60초 타임아웃 — 네트워크 불안정 시 hang 방지
        await task.timeout(const Duration(seconds: 60), onTimeout: () {
          task.cancel();
          throw Exception('업로드 타임아웃 (60초)');
        });
        final url = await storageRef.getDownloadURL();
        debugPrint('[Storage] 업로드 성공: $storagePath (시도 $attempt)');
        return url;
      } catch (e) {
        debugPrint('[Storage] 업로드 실패 (시도 $attempt/$maxAttempts): $e');
        if (attempt < maxAttempts) {
          await Future.delayed(Duration(seconds: attempt * 3)); // 3s, 6s, 9s
        }
      }
    }
    return null;
  }

  Future<void> _uploadAndSave(WorkSpot spot, _Session session, Uint8List bytes) async {
    final key = '${spot.id}_${session.name}';
    // 이미 업로드 중이면 중복 요청 방지
    if (_uploadingKeys.contains(key)) return;
    if (mounted) setState(() { _uploadingKeys.add(key); _failedKeys.remove(key); });
    final storagePath = 'ar_photos/${widget.jobId}/${spot.id}/${session.name}.jpg';
    final url = await _uploadToStorageWithRetry(storagePath, bytes);
    if (mounted) setState(() => _uploadingKeys.remove(key));
    if (url != null) {
      spot.setUrl(session, url);
      if (mounted) setState(() => _failedKeys.remove(key));
    } else {
      if (mounted) setState(() => _failedKeys.add(key));
    }
    await _saveSpotToFirestore(spot);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  // 업로드 대기 중인 사진 수 (URL 없는 로컬 사진 전체)
  int get _pendingUploadCount {
    int c = 0;
    for (final s in _spots) {
      if (s.hasBeforePhoto && s.beforeUrl == null) c++;
      if (s.hasDuringPhoto && s.duringUrl == null) c++;
      if (s.hasAfterPhoto  && s.afterUrl  == null) c++;
      c += s.extraPhotos.where((ep) => ep.url == null && ep.localPath != null).length;
    }
    return c;
  }

  // 메인 화면에서 직접 추가사진 촬영 (스팟 선택 → 카메라 → 업로드)
  Future<void> _captureExtraPhotoFromList() async {
    if (_spots.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('먼저 작업전 사진을 촬영해 스팟을 만드세요'),
        behavior: SnackBarBehavior.floating, backgroundColor: Colors.orange));
      return;
    }

    // 스팟이 1개면 바로, 여러 개면 선택 시트
    WorkSpot? selectedSpot;
    if (_spots.length == 1) {
      selectedSpot = _spots.first;
    } else {
      selectedSpot = await showModalBottomSheet<WorkSpot>(
        context: context,
        backgroundColor: const Color(0xFF1E293B),
        shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        builder: (ctx) => Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            margin: const EdgeInsets.only(top: 12, bottom: 8),
            width: 40, height: 4,
            decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2))),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Align(alignment: Alignment.centerLeft,
              child: Text('추가사진 스팟 선택', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)))),
          const Divider(color: Color(0x1AFFFFFF), height: 1),
          Flexible(child: ListView.builder(
            shrinkWrap: true,
            itemCount: _spots.length,
            itemBuilder: (_, i) {
              final s = _spots[i];
              final extraCount = s.extraPhotos.length;
              return ListTile(
                leading: Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(color: const Color(0x1A14B8A6), borderRadius: BorderRadius.circular(8)),
                  child: s.hasBeforePhoto
                      ? ClipRRect(borderRadius: BorderRadius.circular(8),
                          child: _spotPhotoWidget(s.beforePhotoPath, s.beforeUrl))
                      : const Icon(Icons.place, color: Color(0xFF14B8A6), size: 20)),
                title: Text(s.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14)),
                trailing: extraCount > 0
                    ? Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: const Color(0x1A7DD3FC), borderRadius: BorderRadius.circular(10)),
                        child: Text('+${extraCount}장', style: const TextStyle(color: Color(0xFF7DD3FC), fontSize: 11, fontWeight: FontWeight.bold)))
                    : null,
                onTap: () => Navigator.pop(ctx, s),
              );
            },
          )),
          const SizedBox(height: 16),
        ]),
      );
    }

    if (selectedSpot == null || !mounted) return;

    final path = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (_) => const _CameraCapturePage(
        session: _Session.during, spotName: '',
      )),
    );
    if (path == null || !mounted) return;

    final bytes = await FlutterImageCompress.compressWithFile(
        path, quality: 82, minWidth: 1280, minHeight: 960);
    if (bytes == null) return;

    final id = 'extra_${DateTime.now().millisecondsSinceEpoch}';
    final docsDir = await getApplicationDocumentsDirectory();
    final localPath = '${docsDir.path}/${selectedSpot.id}_$id.jpg';
    await File(localPath).writeAsBytes(bytes);

    final ep = _ExtraPhoto(id: id, localPath: localPath);
    selectedSpot.extraPhotos.add(ep);
    if (mounted) setState(() {});

    // Firestore 먼저 저장 (로컬 경로)
    try {
      await FirebaseFirestore.instance
          .collection('projects').doc(widget.jobId)
          .set({'arSpots': {selectedSpot.id: {'extraPhotos': selectedSpot.extraPhotos.map((e) => e.toMap()).toList()}}},
               SetOptions(merge: true));
    } catch (_) {}

    // 백그라운드 업로드
    _uploadExtraPhotoById(selectedSpot, ep, bytes);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('📷 ${selectedSpot.name} 추가사진 저장 완료 (업로드 중...)'),
        backgroundColor: const Color(0xFF14B8A6),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 3)));
    }
  }

  void _speak(String text) {
    if (!_ttsEnabled) return;
    _tts.stop();
    _tts.speak(text);
  }

  void _hapticLight()  => HapticFeedback.lightImpact();
  void _hapticMedium() => HapticFeedback.mediumImpact();
  void _hapticHeavy()  => HapticFeedback.heavyImpact();

  Future<void> _dimScreen() async {
    try { await ScreenBrightness().setScreenBrightness(0.15); } catch (_) {}
  }

  Future<void> _restoreBrightness() async {
    try { await ScreenBrightness().resetScreenBrightness(); } catch (_) {}
  }

  double _distM(double lat1, double lng1, double lat2, double lng2) {
    final dlat = (lat2 - lat1) * 111320;
    final dlng = (lng2 - lng1) * 111320 * cos(lat1 * pi / 180);
    return sqrt(dlat * dlat + dlng * dlng);
  }

  Future<Position?> _getGPS() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return null;
      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
        if (perm == LocationPermission.denied) return null;
      }
      if (perm == LocationPermission.deniedForever) return null;
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      ).timeout(const Duration(seconds: 8));
    } catch (_) { return null; }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Back guard
  // ─────────────────────────────────────────────────────────────────────────

  Future<bool> _onWillPop() async {
    if (_mode == _Mode.review) {
      setState(() {
        _pendingPath  = null;
        _pendingBytes = null;
        _mode         = _Mode.list;
      });
      return false;
    }
    if (_mode == _Mode.approval) {
      _restoreBrightness();
      setState(() => _mode = _Mode.list);
      return false;
    }
    if (_mode == _Mode.complete) return true;
    if (_spots.isEmpty) return true;
    _hapticMedium();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Row(children: [
          Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 28),
          SizedBox(width: 10),
          Text('나가기', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 17)),
        ]),
        content: const Text(
          '지금까지 촬영한 사진은 서버에 저장되어 있습니다.\n나중에 이어서 작업할 수 있습니다.',
          style: TextStyle(color: Color(0x8AFFFFFF), fontSize: 15, height: 1.6),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false),
            child: const Text('계속 작업', style: TextStyle(color: Colors.white))),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            child: const Text('나가기')),
        ],
      ),
    );
    return ok == true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Session start
  // ─────────────────────────────────────────────────────────────────────────

  void _startBefore() {
    setState(() { _session = _Session.before; _targetSpot = null; });
    _speak('작업 전 사진을 촬영합니다');
    _openCameraPage();
  }

  Future<void> _startDuringOrAfter(_Session session) async {
    // During: need before photo | After: need during photo
    final List<WorkSpot> candidates;
    final String noPhotoMsg;
    if (session == _Session.during) {
      candidates = _spots.where((s) => s.hasBeforePhoto && !s.hasDuringPhoto).toList();
      noPhotoMsg = '작업 전 사진이 없습니다.\n먼저 [작업전 촬영] 버튼으로 작업 전 사진을 찍어주세요.';
    } else if (_photoMode == 'ba') {
      // 2단계(전/후): 전 사진이 있고 후 사진이 없는 스팟
      candidates = _spots.where((s) => s.hasBeforePhoto && !s.hasAfterPhoto).toList();
      noPhotoMsg = '작업 전 사진이 없습니다.\n먼저 [작업전 촬영] 버튼으로 작업 전 사진을 찍어주세요.';
    } else {
      candidates = _spots.where((s) => s.hasDuringPhoto && !s.hasAfterPhoto).toList();
      noPhotoMsg = '작업 중 사진이 없습니다.\n먼저 [작업중 촬영] 버튼으로 작업 중 사진을 찍어주세요.';
    }

    if (candidates.isEmpty) {
      _hapticMedium();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(noPhotoMsg),
        backgroundColor: Colors.orange,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 3),
      ));
      return;
    }

    // GPS auto-sort
    setState(() => _matchingGps = true);
    try {
      final pos = await _getGPS();
      if (!mounted) return;

      if (pos != null) {
        final withDist = candidates.map((s) {
          final d = (s.lat != null && s.lng != null)
              ? _distM(pos.latitude, pos.longitude, s.lat!, s.lng!)
              : double.infinity;
          return MapEntry(s, d);
        }).toList()..sort((a, b) => a.value.compareTo(b.value));

        final nearby30 = withDist.where((e) => e.value < 30).toList();
        final nearby60 = withDist.where((e) => e.value < 60).toList();

        if (nearby30.length == 1 && nearby60.length == 1) {
          _hapticLight();
          _speak('${nearby30.first.key.name} 장소를 자동으로 선택합니다');
          _startCamera(session, nearby30.first.key);
          return;
        }
        _showSpotPicker(withDist.map((e) => e.key).toList(), session, currentPos: pos);
      } else {
        _showSpotPicker(candidates, session, currentPos: null);
      }
    } finally {
      if (mounted) setState(() => _matchingGps = false);
    }
  }

  void _startCamera(_Session session, WorkSpot? spot) {
    setState(() { _session = session; _targetSpot = spot; });
    _speak(spot == null
        ? '${session.label} 사진을 촬영합니다'
        : '${spot.name} ${session.label} 사진을 촬영합니다');
    _openCameraPage();
  }

  Future<void> _openCameraPage() async {
    if (!mounted) return;
    // ghost: 중/후 촬영 시 기준 사진을 반투명 오버랩
    // 2단계(전/후): 후 촬영 시 전 사진을 ghost로 표시
    // 3단계(전/중/후): 중 촬영 시 전 사진, 후 촬영 시 중 사진을 ghost로 표시
    final showGhost = _session != _Session.before && _targetSpot != null;
    final String? ghostPath;
    final String? ghostUrl;
    if (!showGhost) {
      ghostPath = null; ghostUrl = null;
    } else if (_session == _Session.during || _photoMode == 'ba') {
      ghostPath = _targetSpot!.beforePhotoPath;
      ghostUrl  = _targetSpot!.beforeUrl;
    } else {
      ghostPath = _targetSpot!.duringPhotoPath;
      ghostUrl  = _targetSpot!.duringUrl;
    }
    final path = await Navigator.of(context).push<String>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => _CameraCapturePage(
          session: _session,
          spotName: _targetSpot?.name ?? '새 장소',
          ghostLocalPath: ghostPath,
          ghostNetworkUrl: ghostUrl,
        ),
      ),
    );
    if (path == null || !mounted) return;
    try {
      final compressed = await _compressImage(path);
      final wm = await WatermarkService.applyGPSWatermark(compressed);
      await File(path).writeAsBytes(wm);
      if (mounted) {
        setState(() { _pendingPath = path; _pendingBytes = wm; _mode = _Mode.review; });
        _speak('사진을 확인하세요');
      }
    } catch (e) {
      debugPrint('[OpenCamera] post-process error: $e');
      if (mounted) {
        final bytes = await File(path).readAsBytes();
        setState(() { _pendingPath = path; _pendingBytes = bytes; _mode = _Mode.review; });
      }
    }
  }

  void _showSpotPicker(List<WorkSpot> candidates, _Session session, {required Position? currentPos}) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.55, maxChildSize: 0.9, minChildSize: 0.35, expand: false,
        builder: (_, sc) => Column(children: [
          Container(margin: const EdgeInsets.only(top: 12, bottom: 4),
            width: 40, height: 4,
            decoration: BoxDecoration(color: const Color(0x33FFFFFF),
              borderRadius: BorderRadius.circular(2))),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: session.color.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: session.color)),
                child: Text(session.label, style: TextStyle(color: session.color, fontWeight: FontWeight.bold))),
              const SizedBox(width: 12),
              const Text('장소 선택', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
              const Spacer(),
              if (currentPos == null)
                const Row(children: [
                  Icon(Icons.wifi_off, color: Colors.orange, size: 16),
                  SizedBox(width: 4),
                  Text('GPS 없음', style: TextStyle(color: Colors.orange, fontSize: 12)),
                ]),
            ]),
          ),
          const Divider(color: Color(0x1AFFFFFF), height: 1),
          Expanded(child: ListView.builder(
            controller: sc,
            itemCount: candidates.length,
            itemBuilder: (_, i) {
              final spot = candidates[i];
              double? dist;
              if (currentPos != null && spot.lat != null && spot.lng != null) {
                dist = _distM(currentPos.latitude, currentPos.longitude, spot.lat!, spot.lng!);
              }
              final isNearest = i == 0 && dist != null && dist < double.infinity;
              return ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                leading: Stack(children: [
                  Container(
                    width: 52, height: 52,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isNearest ? session.color : const Color(0x33FFFFFF),
                    ),
                    child: Center(child: Text('${i + 1}',
                      style: TextStyle(
                        color: isNearest ? Colors.white : const Color(0x8AFFFFFF),
                        fontWeight: FontWeight.bold, fontSize: 16))),
                  ),
                  // Thumbnail if available
                  if (session == _Session.during && (spot.beforePhotoPath != null || spot.beforeUrl != null))
                    Positioned.fill(child: ClipOval(child: Opacity(
                      opacity: 0.4,
                      child: _spotPhotoWidget(spot.beforePhotoPath, spot.beforeUrl),
                    ))),
                  if (session == _Session.after && _photoMode == 'ba' && (spot.beforePhotoPath != null || spot.beforeUrl != null))
                    Positioned.fill(child: ClipOval(child: Opacity(
                      opacity: 0.4,
                      child: _spotPhotoWidget(spot.beforePhotoPath, spot.beforeUrl),
                    ))),
                  if (session == _Session.after && _photoMode != 'ba' && (spot.duringPhotoPath != null || spot.duringUrl != null))
                    Positioned.fill(child: ClipOval(child: Opacity(
                      opacity: 0.4,
                      child: _spotPhotoWidget(spot.duringPhotoPath, spot.duringUrl),
                    ))),
                ]),
                title: Text(spot.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (dist != null && dist < double.infinity)
                    Text('${dist.toStringAsFixed(0)}m${isNearest ? " · 추천" : ""}',
                      style: TextStyle(color: isNearest ? session.color : const Color(0x61FFFFFF), fontSize: 12))
                  else
                    const Text('거리 정보 없음', style: TextStyle(color: Color(0x61FFFFFF), fontSize: 12)),
                  Row(children: [
                    _photoChipSmall('전', spot.hasBeforePhoto, const Color(0xFF2563EB)),
                    if (_photoMode != 'ba') ...[
                      const SizedBox(width: 4),
                      _photoChipSmall('중', spot.hasDuringPhoto, const Color(0xFFF59E0B)),
                    ],
                    const SizedBox(width: 4),
                    _photoChipSmall('후', spot.hasAfterPhoto,  const Color(0xFF14B8A6)),
                  ]),
                ]),
                trailing: isNearest
                    ? Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: session.color.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: session.color)),
                        child: Text('추천', style: TextStyle(color: session.color, fontSize: 12, fontWeight: FontWeight.bold)))
                    : null,
                onTap: () { Navigator.pop(ctx); _startCamera(session, spot); },
              );
            },
          )),
        ]),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Image helpers
  // ─────────────────────────────────────────────────────────────────────────

  Future<Uint8List> _compressImage(String path) async {
    final result = await FlutterImageCompress.compressWithFile(
      path, minWidth: 1920, minHeight: 1080, quality: 82, format: CompressFormat.jpeg);
    return result ?? await File(path).readAsBytes();
  }

  // ── 16×16 thumbnail perceptual similarity [0.0–1.0]
  Future<double> _computeSimilarity(Uint8List a, Uint8List b) async {
    const sz = 16;
    final codecA = await ui.instantiateImageCodec(a, targetWidth: sz, targetHeight: sz);
    final frameA = await codecA.getNextFrame();
    final dataA  = await frameA.image.toByteData(format: ui.ImageByteFormat.rawRgba);
    frameA.image.dispose();

    final codecB = await ui.instantiateImageCodec(b, targetWidth: sz, targetHeight: sz);
    final frameB = await codecB.getNextFrame();
    final dataB  = await frameB.image.toByteData(format: ui.ImageByteFormat.rawRgba);
    frameB.image.dispose();

    if (dataA == null || dataB == null) return 1.0;
    final bA = dataA.buffer.asUint8List();
    final bB = dataB.buffer.asUint8List();
    int totalDiff = 0;
    for (int i = 0; i < sz * sz * 4; i += 4) {
      final gA = (bA[i] * 0.299 + bA[i + 1] * 0.587 + bA[i + 2] * 0.114).round();
      final gB = (bB[i] * 0.299 + bB[i + 1] * 0.587 + bB[i + 2] * 0.114).round();
      totalDiff += (gA - gB).abs();
    }
    return 1.0 - (totalDiff / (sz * sz * 255));
  }

  // GPS 거리 & 이미지 유사도 검사 → true: 저장, false: 재촬영
  Future<bool> _checkPhotoAndWarn() async {
    if (_session == _Session.before) return true;

    final warnings = <String>[];

    // 1. GPS 거리 검사 (캐시된 위치 사용, 즉시 반환)
    if (_targetSpot?.lat != null && _currentPos != null) {
      final dist = _distM(
        _currentPos!.latitude, _currentPos!.longitude,
        _targetSpot!.lat!, _targetSpot!.lng!);
      if (dist > 80) {
        warnings.add(
          '📍 현재 위치가 「${_targetSpot!.name}」에서 '
          '${dist.toStringAsFixed(0)}m 떨어져 있습니다.\n'
          '다른 장소에서 촬영한 사진이 아닌지 확인하세요.');
      }
    }

    // 2. 이미지 유사도 검사 (작업전 로컬 파일과 비교)
    if (_pendingBytes != null) {
      Uint8List? ghostBytes;
      final ghostPath = _targetSpot?.beforePhotoPath;
      if (ghostPath != null) {
        try {
          final f = File(ghostPath);
          if (await f.exists()) ghostBytes = await f.readAsBytes();
        } catch (_) {}
      }
      if (ghostBytes != null) {
        try {
          final sim = await _computeSimilarity(ghostBytes, _pendingBytes!);
          if (sim < 0.18) {
            warnings.add(
              '🖼️ 촬영한 사진이 작업 전 사진과 구도·배경이 너무 다릅니다.\n'
              '장소가 맞는지 확인 후 재촬영을 권장합니다.');
          }
        } catch (_) {}
      }
    }

    if (warnings.isEmpty) return true;
    if (!mounted) return false;

    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Row(children: [
          Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 28),
          SizedBox(width: 10),
          Text('사진 확인 필요',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 17)),
        ]),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ...warnings.map((w) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(w,
                style: const TextStyle(color: Color(0xCCFFFFFF), fontSize: 14, height: 1.55)))),
            const Divider(color: Color(0x1AFFFFFF), height: 20),
            const Text('재촬영을 권장하지만 그냥 저장할 수도 있습니다.',
              style: TextStyle(color: Color(0x61FFFFFF), fontSize: 12)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('그냥 저장',
              style: TextStyle(color: Colors.white54, fontSize: 14))),
          ElevatedButton.icon(
            onPressed: () => Navigator.pop(ctx, false),
            icon: const Icon(Icons.replay, size: 18),
            label: const Text('재촬영'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.orange, foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)))),
        ],
      ),
    );
    return result == true;
  }

  Future<void> _confirmPhoto() async {
    if (_pendingPath == null || _pendingBytes == null || _checking) return;
    _hapticHeavy();
    setState(() => _checking = true);
    try {
      final proceed = await _checkPhotoAndWarn();
      if (!proceed) {
        if (mounted) {
          setState(() { _pendingPath = null; _pendingBytes = null; });
          _openCameraPage();
        }
        return;
      }
    } finally {
      if (mounted) setState(() => _checking = false);
    }
    final origPath = _pendingPath!;
    final bytes    = _pendingBytes!;

    WorkSpot spot;
    if (_session == _Session.before && _targetSpot == null) {
      _spotCounter++;
      spot = WorkSpot(
        id:   'SPOT_$_spotCounter',
        name: '${widget.jobName}_${_spotCounter.toString().padLeft(2, '0')}',
      );
      _spots.add(spot);
    } else {
      if (_targetSpot == null) {
        if (mounted) setState(() { _pendingPath = null; _pendingBytes = null; _mode = _Mode.list; });
        return;
      }
      spot = _targetSpot!;
    }

    // 앱 문서 폴더에 영구 저장 → 경로를 spot에 기록
    // 실패해도 카메라 임시 경로로 대체 (앱 세션 내에서는 표시 가능)
    String localPath = origPath;
    try {
      localPath = await OfflineSyncService.savePhotoLocally(
        jobId: widget.jobId, jobName: widget.jobName,
        workStep: _session.label,
        latitude: spot.lat ?? 0, longitude: spot.lng ?? 0,
        imageBytes: bytes,
      );
    } catch (e) {
      debugPrint('[ConfirmPhoto] 로컬 저장 오류 (임시 경로 사용): $e');
    }

    spot.setPath(_session, localPath);
    // 소요시간 자동 기록
    if (_session == _Session.before) spot.startedAt   = DateTime.now();
    if (_session == _Session.after)  spot.completedAt = DateTime.now();
    _speak('저장되었습니다');

    // 로컬 경로 포함해 Firestore에 즉시 저장 (업로드 전에도 재시작 시 복원 가능)
    _saveSpotToFirestore(spot);
    if (_session == _Session.before) _saveSpotGPS(spot);

    final capturedSpot    = spot;
    final capturedSession = _session;
    setState(() { _pendingPath = null; _pendingBytes = null; _mode = _Mode.list; });

    // 다음 단계 자동 안내 SnackBar
    if (mounted) {
      final nextSession = capturedSession == _Session.before
          ? (_photoMode == 'ba' ? _Session.after : _Session.during)
          : capturedSession == _Session.during ? _Session.after : null;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('✅ ${capturedSpot.name} · ${capturedSession.label} 저장 완료'),
        backgroundColor: capturedSession.color,
        duration: const Duration(seconds: 4),
        behavior: SnackBarBehavior.floating,
        action: nextSession != null ? SnackBarAction(
          label: '${nextSession.label} 바로 촬영 →',
          textColor: Colors.white,
          onPressed: () {
            ScaffoldMessenger.of(context).hideCurrentSnackBar();
            _startCamera(nextSession, capturedSpot);
          },
        ) : null,
      ));
    }

    // Firebase Storage 업로드 + Firestore 저장 (백그라운드)
    _uploadAndSave(spot, _session, bytes);
  }

  Future<void> _saveSpotGPS(WorkSpot spot) async {
    if (!mounted) return;
    final pos = await _getGPS();
    if (pos == null) return;
    spot.lat = pos.latitude;
    spot.lng = pos.longitude;
    _saveSpotToFirestore(spot);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Approval / delete
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> _requestFinalApproval() async {
    final code = (1000 + Random().nextInt(9000)).toString();
    _codeCtrl.clear();
    _approvalHandled = false;
    setState(() { _approvalCode = code; _approvalOffline = false; _mode = _Mode.approval; });
    _dimScreen(); _speak('감독자 승인을 요청하세요');
    try {
      await FirebaseFirestore.instance
          .collection('approvals').doc('${widget.jobId}_final')
          .set({ 'status': 'pending', 'code': code,
            'jobId': widget.jobId, 'jobName': widget.jobName,
            'stage': 'final', 'submittedAt': FieldValue.serverTimestamp() });
    } catch (_) { if (mounted) setState(() => _approvalOffline = true); }
  }

  void _deleteSpot(WorkSpot spot) {
    _hapticMedium();
    showDialog(context: context, builder: (ctx) => AlertDialog(
      backgroundColor: const Color(0xFF1E293B),
      title: const Text('장소 삭제', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      content: Text('「${spot.name}」 장소와 사진을 삭제할까요?',
        style: const TextStyle(color: Color(0x8AFFFFFF), fontSize: 15, height: 1.5)),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx),
          child: const Text('취소', style: TextStyle(color: Colors.white))),
        ElevatedButton(
          onPressed: () {
            Navigator.pop(ctx);
            setState(() => _spots.remove(spot));
            _speak('삭제되었습니다');
            FirebaseFirestore.instance
                .collection('projects').doc(widget.jobId)
                .update({'arSpots.${spot.id}': FieldValue.delete()})
                .catchError((e) => debugPrint('[Firestore] spot delete: $e'));
          },
          style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
          child: const Text('삭제')),
      ],
    ));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Navigation (kakao)
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> _openSiteNavigation() async {
    _hapticLight();
    final lat = widget.jobLat, lng = widget.jobLng;
    final name = Uri.encodeComponent(widget.jobName);
    final kakaoUrl = Uri.parse('kakaonavi://navigate?ep=$lat,$lng&name=$name');
    final mapUrl   = Uri.parse('https://map.kakao.com/link/to/$name,$lat,$lng');
    if (await canLaunchUrl(kakaoUrl)) await launchUrl(kakaoUrl);
    else await launchUrl(mapUrl, mode: LaunchMode.externalApplication);
  }

  // 앱 내 나침반 도보 안내 (100m 이내 현장 내 이동)
  Future<void> _navigateToSpot(WorkSpot spot) async {
    if (spot.lat == null || spot.lng == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('GPS 위치 정보가 없습니다.\n먼저 작업전 사진을 촬영하면 위치가 저장됩니다.'),
        backgroundColor: Colors.orange, behavior: SnackBarBehavior.floating,
        duration: Duration(seconds: 4)));
      return;
    }
    _hapticLight();
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => _SpotCompassPage(
        spot: spot,
        onExternalNav: () => _openExternalNav(spot),
      ),
    ));
  }

  // KakaoNavi 외부 앱 안내 (원거리 또는 사용자 선택 시)
  Future<void> _openExternalNav(WorkSpot spot) async {
    if (spot.lat == null || spot.lng == null) return;
    final lat  = spot.lat!, lng = spot.lng!;
    final name = Uri.encodeComponent(spot.name);
    final kakaoUrl = Uri.parse('kakaonavi://navigate?ep=$lat,$lng&name=$name');
    final mapUrl   = Uri.parse('https://map.kakao.com/link/to/$name,$lat,$lng');
    if (await canLaunchUrl(kakaoUrl)) await launchUrl(kakaoUrl);
    else await launchUrl(mapUrl, mode: LaunchMode.externalApplication);
  }

  Future<void> _openSpotDetail(WorkSpot spot) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => _SpotDetailPage(
          spot: spot,
          jobId: widget.jobId,
          onNavigate: () => _navigateToSpot(spot), // compass nav
        ),
      ),
    );
    if (mounted) setState(() {});
  }

  // ─────────────────────────────────────────────────────────────────────────
  // List View
  // ─────────────────────────────────────────────────────────────────────────

  Widget _buildListView() {
    final hasComplete = _spots.any((s) => s.isCompleteFor(_photoMode));
    final totalB = _spots.where((s) => s.hasBeforePhoto).length;
    final totalD = _spots.where((s) => s.hasDuringPhoto).length;
    final totalA = _spots.where((s) => s.hasAfterPhoto).length;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(child: Column(children: [
        // Header
        Container(
          padding: const EdgeInsets.fromLTRB(4, 8, 12, 8),
          decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0x1AFFFFFF)))),
          child: Row(children: [
            IconButton(
              icon: const Icon(Icons.close, color: Colors.white, size: 28),
              onPressed: () => _onWillPop().then((ok) { if (ok) Navigator.pop(context); }),
            ),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(widget.jobName,
                style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                overflow: TextOverflow.ellipsis),
              Text(_photoMode == 'ba'
                  ? '전:$totalB  후:$totalA  (총 ${_spots.length}곳)'
                  : '전:$totalB  중:$totalD  후:$totalA  (총 ${_spots.length}곳)',
                style: const TextStyle(color: Color(0x8AFFFFFF), fontSize: 11)),
              if (_weatherText.isNotEmpty)
                Row(children: [
                  const Icon(Icons.wb_sunny_outlined, color: Color(0xFFFBBF24), size: 12),
                  const SizedBox(width: 4),
                  Text(_weatherText, style: const TextStyle(color: Color(0xFFFBBF24), fontSize: 11)),
                ]),
              if (_uploadingKeys.isNotEmpty)
                Row(children: [
                  const SizedBox(width: 10, height: 10,
                    child: CircularProgressIndicator(strokeWidth: 1.5, color: Color(0xFF7DD3FC))),
                  const SizedBox(width: 5),
                  Text('서버 전송 중 ${_uploadingKeys.length}건',
                    style: const TextStyle(color: Color(0xFF7DD3FC), fontSize: 11)),
                ])
              else if (_failedKeys.isNotEmpty)
                Row(children: [
                  const Icon(Icons.wifi_off, color: Colors.orange, size: 12),
                  const SizedBox(width: 4),
                  Text('전송 실패 ${_failedKeys.length}건 (재시도 중)',
                    style: const TextStyle(color: Colors.orange, fontSize: 11)),
                ])
              else if (_pendingUploadCount > 0)
                Row(children: [
                  const Icon(Icons.cloud_upload_outlined, color: Color(0xFF7DD3FC), size: 12),
                  const SizedBox(width: 4),
                  Text('업로드 대기 $_pendingUploadCount건',
                    style: const TextStyle(color: Color(0xFF7DD3FC), fontSize: 11)),
                ])
              else if (_spots.isNotEmpty && _spots.every((s) => s.isCompleteFor(_photoMode) || s.extraPhotos.isNotEmpty))
                const Row(children: [
                  Icon(Icons.cloud_done, color: Color(0xFF14B8A6), size: 12),
                  SizedBox(width: 4),
                  Text('모든 사진 서버 저장 완료',
                    style: TextStyle(color: Color(0xFF14B8A6), fontSize: 11)),
                ]),
            ])),
            GestureDetector(
              onTap: _openSiteNavigation,
              child: Container(
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEE500).withValues(alpha: 0.12), shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFFFEE500).withValues(alpha: 0.4))),
                child: const Icon(Icons.navigation, color: Color(0xFFFEE500), size: 22),
              ),
            ),
            if (hasComplete)
              ElevatedButton(
                onPressed: _requestFinalApproval,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF14B8A6), foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                child: const Text('완료', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              ),
          ]),
        ),
        _buildFilterTabs(),
        Expanded(child: _loadingSpots
            ? const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                CircularProgressIndicator(color: Color(0xFF14B8A6)),
                SizedBox(height: 12),
                Text('이전 작업 불러오는 중...', style: TextStyle(color: Color(0x8AFFFFFF), fontSize: 13)),
              ]))
            : _buildFilteredContent()),
        _buildActionBar(),
      ])),
    );
  }

  Widget _buildFilterTabs() {
    final tabs = [
      ('all',    '전체',   Icons.grid_view_rounded),
      ('before', '작업전', Icons.camera_alt),
      if (_photoMode != 'ba') ('during', '작업중', Icons.layers),
      ('after',  '작업후', Icons.check_circle),
    ];
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 6, 4),
      child: Row(children: tabs.map((t) {
        final isActive = _filterTab == t.$1;
        final color = switch (t.$1) {
          'before' => const Color(0xFF2563EB),
          'during' => const Color(0xFFF59E0B),
          'after'  => const Color(0xFF14B8A6),
          _        => Colors.white,
        };
        return Expanded(child: GestureDetector(
          onTap: () => setState(() => _filterTab = t.$1),
          child: Container(
            margin: const EdgeInsets.only(right: 6),
            padding: const EdgeInsets.symmetric(vertical: 9),
            decoration: BoxDecoration(
              color: isActive ? color.withValues(alpha: 0.18) : const Color(0x0AFFFFFF),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: isActive ? color : const Color(0x1AFFFFFF))),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(t.$3, color: isActive ? color : const Color(0x4DFFFFFF), size: 17),
              const SizedBox(height: 3),
              Text(t.$2, style: TextStyle(
                color: isActive ? color : const Color(0x4DFFFFFF),
                fontSize: 10, fontWeight: isActive ? FontWeight.bold : FontWeight.normal)),
            ]),
          ),
        ));
      }).toList()),
    );
  }

  Widget _buildFilteredContent() {
    if (_filterTab == 'all') return _buildSpotList();
    final session = switch (_filterTab) {
      'before' => _Session.before, 'during' => _Session.during, _ => _Session.after,
    };
    return _buildPhotoGrid(session);
  }

  Widget _buildSpotList() {
    if (_spots.isEmpty) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.photo_camera_outlined, color: Color(0x33FFFFFF), size: 72),
        const SizedBox(height: 16),
        const Text('촬영된 장소가 없습니다', style: TextStyle(color: Color(0x61FFFFFF), fontSize: 16)),
        const SizedBox(height: 8),
        const Text('아래 [작업전 촬영] 버튼으로 시작하세요', style: TextStyle(color: Color(0x4DFFFFFF), fontSize: 13)),
      ]));
    }

    // GPS 위치 기준 가까운 순 정렬
    final sorted = List<WorkSpot>.from(_spots);
    final pos = _currentPos;
    if (pos != null) {
      sorted.sort((a, b) {
        final da = (a.lat != null && a.lng != null)
            ? _distM(pos.latitude, pos.longitude, a.lat!, a.lng!) : double.infinity;
        final db = (b.lat != null && b.lng != null)
            ? _distM(pos.latitude, pos.longitude, b.lat!, b.lng!) : double.infinity;
        return da.compareTo(db);
      });
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      itemCount: sorted.length,
      itemBuilder: (_, i) {
        final spot = sorted[i];
        final dist = (pos != null && spot.lat != null && spot.lng != null)
            ? _distM(pos.latitude, pos.longitude, spot.lat!, spot.lng!) : null;
        return GestureDetector(
          onTap: () => _openSpotDetail(spot),
          onLongPress: () => _deleteSpot(spot),
          child: Container(
            margin: const EdgeInsets.symmetric(vertical: 5),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(14),
              border: Border.all(color: spot.isCompleteFor(_photoMode)
                  ? const Color(0xFF14B8A6).withValues(alpha: 0.5)
                  : const Color(0x1AFFFFFF))),
            child: Row(children: [
              // Spot thumbnail (before photo)
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: SizedBox(
                  width: 56, height: 56,
                  child: spot.hasBeforePhoto
                      ? _spotPhotoWidget(spot.beforePhotoPath, spot.beforeUrl)
                      : Container(
                          color: const Color(0x1AFFFFFF),
                          child: Center(child: Text('${i + 1}',
                            style: const TextStyle(color: Colors.white54, fontWeight: FontWeight.bold, fontSize: 18)))),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(spot.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                const SizedBox(height: 4),
                Row(children: [
                  _photoChip('전', spot.hasBeforePhoto, const Color(0xFF2563EB)),
                  if (_photoMode != 'ba') ...[
                    const SizedBox(width: 5),
                    _photoChip('중', spot.hasDuringPhoto, const Color(0xFFF59E0B)),
                  ],
                  const SizedBox(width: 5),
                  _photoChip('후', spot.hasAfterPhoto,  const Color(0xFF14B8A6)),
                  // 업로드 상태 배지
                  Builder(builder: (_) {
                    final uploadingNow = _Session.values.any((s) => _uploadingKeys.contains('${spot.id}_${s.name}')) ||
                        spot.extraPhotos.any((ep) => _uploadingKeys.contains('${spot.id}_extra_${ep.id}'));
                    final hasFailed = _Session.values.any((s) => _failedKeys.contains('${spot.id}_${s.name}')) ||
                        spot.extraPhotos.any((ep) => _failedKeys.contains('${spot.id}_extra_${ep.id}'));
                    final allUploaded = (!spot.hasBeforePhoto || spot.beforeUrl != null) &&
                        (!spot.hasDuringPhoto || spot.duringUrl != null) &&
                        (!spot.hasAfterPhoto  || spot.afterUrl  != null) &&
                        spot.extraPhotos.every((ep) => ep.url != null);
                    if (uploadingNow) return const Padding(
                      padding: EdgeInsets.only(left: 6),
                      child: SizedBox(width: 10, height: 10,
                        child: CircularProgressIndicator(strokeWidth: 1.5, color: Color(0xFF7DD3FC))));
                    if (hasFailed) return const Padding(
                      padding: EdgeInsets.only(left: 5),
                      child: Icon(Icons.wifi_off, color: Colors.orange, size: 12));
                    if (allUploaded && spot.photoCount > 0) return const Padding(
                      padding: EdgeInsets.only(left: 5),
                      child: Icon(Icons.cloud_done, color: Color(0xFF14B8A6), size: 12));
                    return const SizedBox.shrink();
                  }),
                  // 추가사진 수 표시
                  if (spot.extraPhotos.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(left: 5),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(color: const Color(0x1A7DD3FC), borderRadius: BorderRadius.circular(6)),
                        child: Text('+${spot.extraPhotos.length}',
                          style: const TextStyle(color: Color(0xFF7DD3FC), fontSize: 9, fontWeight: FontWeight.bold)))),
                ]),
                // 거리 표시
                if (dist != null) ...[
                  const SizedBox(height: 3),
                  Row(children: [
                    const Icon(Icons.location_on, color: Color(0xFF14B8A6), size: 12),
                    const SizedBox(width: 3),
                    Text(
                      dist < 1000 ? '${dist.toStringAsFixed(0)}m' : '${(dist/1000).toStringAsFixed(1)}km',
                      style: TextStyle(
                        color: dist < 30 ? const Color(0xFF14B8A6) : const Color(0x8AFFFFFF),
                        fontSize: 11)),
                  ]),
                ],
                // 소요시간 표시
                if (spot.durationLabel != null) ...[
                  const SizedBox(height: 3),
                  Row(children: [
                    const Icon(Icons.timer_outlined, color: Color(0xFFF59E0B), size: 12),
                    const SizedBox(width: 3),
                    Text(spot.durationLabel!,
                      style: const TextStyle(color: Color(0xFFF59E0B), fontSize: 11)),
                  ]),
                ],
              ])),
              // 우측: 네비게이션 + 상세보기 버튼
              Column(mainAxisSize: MainAxisSize.min, children: [
                if (spot.lat != null)
                  GestureDetector(
                    onTap: () => _navigateToSpot(spot),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: const BoxDecoration(color: Color(0x1A2563EB), shape: BoxShape.circle),
                      child: const Icon(Icons.navigation, color: Color(0xFF2563EB), size: 20),
                    ),
                  ),
                const SizedBox(height: 4),
                const Icon(Icons.chevron_right, color: Color(0x4DFFFFFF), size: 20),
              ]),
            ]),
          ),
        );
      },
    );
  }

  Widget _buildPhotoGrid(_Session session) {
    final withPhotos = _spots.where((s) => s.hasPhotoFor(session)).toList();
    if (withPhotos.isEmpty) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.photo_library_outlined, color: Color(0x33FFFFFF), size: 72),
        const SizedBox(height: 16),
        Text('${session.label} 사진이 없습니다',
          style: const TextStyle(color: Color(0x61FFFFFF), fontSize: 16)),
      ]));
    }
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2, crossAxisSpacing: 8, mainAxisSpacing: 8),
      itemCount: withPhotos.length,
      itemBuilder: (_, i) {
        final spot = withPhotos[i];
        return Stack(children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: _spotPhotoWidget(spot.pathFor(session), spot.urlFor(session))),
          Positioned(bottom: 0, left: 0, right: 0,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: const BoxDecoration(
                gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter,
                  colors: [Colors.black87, Colors.transparent]),
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(12))),
              child: Text(spot.name,
                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                overflow: TextOverflow.ellipsis))),
          // Upload pending badge
          if (spot.urlFor(session) == null && spot.pathFor(session) != null)
            Positioned(top: 8, right: 8,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(6)),
                child: const SizedBox(width: 12, height: 12,
                  child: CircularProgressIndicator(strokeWidth: 1.5, color: Colors.white54)))),
        ]);
      },
    );
  }

  Widget _buildActionBar() {
    final allButtons = [
      (_Session.before, '작업전', Icons.camera_alt),
      (_Session.during, '작업중', Icons.layers),
      (_Session.after,  '작업후', Icons.check_circle),
    ];
    final buttons = _photoMode == 'ba'
        ? allButtons.where((t) => t.$1 != _Session.during).toList()
        : allButtons;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
      decoration: const BoxDecoration(border: Border(top: BorderSide(color: Color(0x1AFFFFFF)))),
      child: Column(children: [
        // 사진 모드 표시
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(_photoMode == 'ba' ? Icons.looks_two : Icons.looks_3,
              size: 14, color: Colors.white54),
            const SizedBox(width: 4),
            Text(_photoMode == 'ba' ? '전·후 2단계 촬영' : '전·중·후 3단계 촬영',
              style: const TextStyle(fontSize: 11, color: Colors.white54)),
          ]),
        ),
        // ── 전/[중]/후 촬영 버튼 행
        Row(children: buttons.map((t) {
          final (session, label, icon) = t;
          final isLoading = _matchingGps && session != _Session.before;
          return Expanded(child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: SizedBox(height: kBtnH, child: ElevatedButton(
              onPressed: _matchingGps ? null : () {
                if (session == _Session.before) _startBefore();
                else _startDuringOrAfter(session);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: session.color.withValues(alpha: 0.9),
                foregroundColor: Colors.white,
                disabledBackgroundColor: session.color.withValues(alpha: 0.3),
                padding: const EdgeInsets.symmetric(vertical: 4),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              child: isLoading
                  ? const SizedBox(width: 20, height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Column(mainAxisSize: MainAxisSize.min, children: [
                      Icon(icon, size: 20), const SizedBox(height: 2),
                      Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                    ]),
            )),
          ));
        }).toList()),
        // ── 추가사진 버튼 행
        const SizedBox(height: 8),
        SizedBox(
          height: 52,
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _captureExtraPhotoFromList,
            icon: const Icon(Icons.add_a_photo, size: 20),
            label: const Text('작업중 추가사진 촬영', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, letterSpacing: 0.3)),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFF59E0B),
              foregroundColor: Colors.white,
              elevation: 6,
              shadowColor: const Color(0xFFF59E0B).withValues(alpha: 0.5),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ),
      ]),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Review View
  // ─────────────────────────────────────────────────────────────────────────

  Widget _buildReviewView() {
    final spotName = _targetSpot?.name ?? '새 장소';
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(children: [
        if (_pendingPath != null)
          Positioned.fill(child: Image.file(
            File(_pendingPath!), fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => const Center(
              child: Icon(Icons.broken_image_outlined, color: Colors.white54, size: 72)),
          )),
        Positioned(top: 0, left: 0, right: 0, child: Container(
          padding: const EdgeInsets.fromLTRB(16, 52, 16, 16),
          decoration: const BoxDecoration(gradient: LinearGradient(
            begin: Alignment.topCenter, end: Alignment.bottomCenter,
            colors: [Colors.black87, Colors.transparent])),
          child: Column(children: [
            const Icon(Icons.photo_camera, color: Color(0xFF14B8A6), size: 34),
            const SizedBox(height: 8),
            Text('$spotName · ${_session.label}',
              style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            const Text('사진을 확인하세요. 문제가 있으면 재촬영하세요.',
              style: TextStyle(color: Color(0x8AFFFFFF), fontSize: 14)),
          ]))),
        Positioned(bottom: 0, left: 0, right: 0, child: Container(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 44),
          decoration: const BoxDecoration(gradient: LinearGradient(
            begin: Alignment.bottomCenter, end: Alignment.topCenter,
            colors: [Colors.black87, Colors.transparent])),
          child: Row(children: [
            Expanded(child: SizedBox(height: kBtnH + 14, child: OutlinedButton.icon(
              onPressed: () {
                _hapticLight(); _speak('재촬영합니다');
                setState(() { _pendingPath = null; _pendingBytes = null; });
                _openCameraPage();
              },
              icon: const Icon(Icons.replay, size: kIconSz),
              label: const Text('재촬영', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              style: OutlinedButton.styleFrom(foregroundColor: Colors.redAccent,
                side: const BorderSide(color: Colors.redAccent, width: 2),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)))))),
            const SizedBox(width: 18),
            Expanded(child: SizedBox(height: kBtnH + 14, child: ElevatedButton.icon(
              onPressed: _checking ? null : _confirmPhoto,
              icon: _checking
                  ? const SizedBox(width: kIconSz, height: kIconSz,
                      child: CircularProgressIndicator(strokeWidth: 3, color: Colors.white))
                  : const Icon(Icons.check, size: kIconSz),
              label: Text(_checking ? '검사 중...' : '저장',
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF14B8A6),
                foregroundColor: Colors.white,
                disabledBackgroundColor: const Color(0xFF0E7A70),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)))))),
          ]))),
      ]),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Approval View
  // ─────────────────────────────────────────────────────────────────────────

  Widget _buildApprovalView() {
    final completeCount = _spots.where((s) => s.isCompleteFor(_photoMode)).length;
    final totalPhotos   = _spots.fold(0, (a, s) => a + s.photoCount);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: StreamBuilder<DocumentSnapshot>(
        stream: _approvalOffline || _approvalCode == null
            ? const Stream.empty()
            : FirebaseFirestore.instance
                .collection('approvals').doc('${widget.jobId}_final').snapshots(),
        builder: (ctx, snap) {
          if (snap.hasData && snap.data!.exists) {
            final d = snap.data!.data() as Map<String, dynamic>? ?? {};
            if (d['status'] == 'approved' && mounted && !_approvalHandled) {
              _approvalHandled = true;
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (!mounted) return;
                _hapticHeavy(); _restoreBrightness();
                setState(() => _mode = _Mode.complete); _speak('승인되었습니다');
              });
            }
          }
          return SafeArea(child: Padding(padding: const EdgeInsets.all(24), child: Column(children: [
            const SizedBox(height: 16),
            Container(
              width: double.infinity, padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFF14B8A6).withValues(alpha: 0.5))),
              child: Column(children: [
                const Text('감독자 승인 코드',
                  style: TextStyle(color: Color(0xFF7DD3FC), fontSize: 14, letterSpacing: 2)),
                const SizedBox(height: 10),
                Text(_approvalCode ?? '----',
                  style: const TextStyle(color: Color(0xFF14B8A6), fontSize: 80,
                    fontWeight: FontWeight.bold, letterSpacing: 14)),
                const SizedBox(height: 6),
                const Text('최종 작업 승인',
                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                Text('$completeCount개 장소 완료 · 총 $totalPhotos장 촬영\n감독자의 최종 확인 후 작업 완료 처리됩니다.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0x8AFFFFFF), fontSize: 13, height: 1.5)),
              ])),
            const SizedBox(height: 20),
            if (_approvalOffline)
              Container(padding: const EdgeInsets.all(12), margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(color: Colors.orange.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.orange.withValues(alpha: 0.4))),
                child: const Row(children: [
                  Icon(Icons.wifi_off, color: Colors.orange, size: 22),
                  SizedBox(width: 10),
                  Expanded(child: Text('오프라인 상태입니다. 코드 직접 입력으로 승인하세요.',
                    style: TextStyle(color: Colors.orange, fontSize: 13))),
                ]))
            else
              const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                SizedBox(width: 18, height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF14B8A6))),
                SizedBox(width: 12),
                Text('감독자 PC에서 승인 대기 중...',
                  style: TextStyle(color: Color(0xFF7DD3FC), fontSize: 14)),
              ]),
            const Spacer(),
            TextButton(onPressed: () { _restoreBrightness(); setState(() => _mode = _Mode.list); },
              child: const Text('← 목록으로 돌아가기',
                style: TextStyle(color: Color(0x8AFFFFFF), fontSize: 13))),
            const Text('감독자에게 코드를 보여주거나\n승인 코드를 직접 입력하세요',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0x8AFFFFFF), fontSize: 14, height: 1.5)),
            const SizedBox(height: 14),
            Row(children: [
              Expanded(child: TextField(
                controller: _codeCtrl, keyboardType: TextInputType.number,
                maxLength: 4, textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 32,
                  fontWeight: FontWeight.bold, letterSpacing: 10),
                decoration: InputDecoration(counterText: '', hintText: '0000',
                  hintStyle: const TextStyle(color: Color(0x3DFFFFFF), letterSpacing: 10),
                  filled: true, fillColor: const Color(0xFF1E293B),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0x3DFFFFFF))),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFF14B8A6), width: 2))))),
              const SizedBox(width: 12),
              SizedBox(height: kBtnH, child: ElevatedButton(
                onPressed: () {
                  if (_codeCtrl.text.trim() == _approvalCode) {
                    _hapticHeavy(); _restoreBrightness();
                    setState(() => _mode = _Mode.complete); _speak('승인되었습니다');
                  } else {
                    _hapticMedium();
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                      content: Text('코드가 올바르지 않습니다'), backgroundColor: Colors.redAccent));
                  }
                },
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF14B8A6),
                  foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(horizontal: 26),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                child: const Text('확인', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)))),
            ]),
          ])));
        },
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Complete View
  // ─────────────────────────────────────────────────────────────────────────

  Widget _buildCompleteView() {
    final total = _spots.fold(0, (s, sp) => s + sp.photoCount);
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 28),
        child: Column(children: [
          const SizedBox(height: 20),
          const Icon(Icons.emoji_events, color: Color(0xFFF59E0B), size: 96),
          const SizedBox(height: 16),
          const Text('수고하셨습니다!',
            style: TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          Text('${_spots.length}개 장소 · 총 $total장 촬영 완료',
            style: const TextStyle(color: Color(0x8AFFFFFF), fontSize: 16)),
          const SizedBox(height: 6),
          Text('${widget.jobName} 작업이 성공적으로 기록되었습니다.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFF7DD3FC), fontSize: 14)),
          const SizedBox(height: 24),
          Expanded(child: ListView.separated(
            itemCount: _spots.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (ctx, i) {
              final s = _spots[i];
              return Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(12)),
                child: Row(children: [
                  ClipRRect(borderRadius: BorderRadius.circular(8),
                    child: SizedBox(width: 48, height: 48,
                      child: s.hasBeforePhoto
                          ? _spotPhotoWidget(s.beforePhotoPath, s.beforeUrl)
                          : Container(color: const Color(0x33FFFFFF),
                              child: Center(child: Icon(Icons.hide_image_outlined,
                                color: Colors.white38, size: 22))))),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(s.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                    const SizedBox(height: 5),
                    Row(children: [
                      _photoChip('전', s.hasBeforePhoto, const Color(0xFF2563EB)),
                      const SizedBox(width: 6),
                      if (_photoMode == 'bda') ...[
                        _photoChip('중', s.hasDuringPhoto, const Color(0xFFF59E0B)),
                        const SizedBox(width: 6),
                      ],
                      _photoChip('후', s.hasAfterPhoto,  const Color(0xFF14B8A6)),
                    ]),
                  ])),
                  Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(shape: BoxShape.circle,
                      color: s.isCompleteFor(_photoMode) ? const Color(0xFF14B8A6) : Colors.orange),
                    child: Center(child: s.isCompleteFor(_photoMode)
                      ? const Icon(Icons.check, color: Colors.white, size: 20)
                      : Text('${s.photoCount}/${_photoMode == 'ba' ? 2 : 3}', style: const TextStyle(
                          color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)))),
                ]),
              );
            })),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: const Color(0xFF0F2A4A), borderRadius: BorderRadius.circular(12)),
            child: const Row(children: [
              Icon(Icons.cloud_done, color: Color(0xFF7DD3FC), size: 24),
              SizedBox(width: 10),
              Expanded(child: Text('모든 사진이 서버에 저장되어 있습니다.\n언제든 PC에서 현장 사진 관리 메뉴에서 확인하세요.',
                style: TextStyle(color: Color(0xFF7DD3FC), fontSize: 13, height: 1.5))),
            ])),
          const SizedBox(height: 14),
          SizedBox(width: double.infinity, height: kBtnH + 6,
            child: ElevatedButton.icon(
              onPressed: () { _hapticHeavy(); OfflineSyncService.syncPendingPhotos(); Navigator.pop(context, true); },
              icon: const Icon(Icons.check_circle, size: kIconSz),
              label: const Text('작업 완료 처리', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF14B8A6),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))))),
        ]))),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Common widgets
  // ─────────────────────────────────────────────────────────────────────────

  Widget _spotPhotoWidget(String? localPath, String? networkUrl) {
    if (localPath != null) {
      try {
        if (File(localPath).existsSync()) {
          return Image.file(File(localPath), fit: BoxFit.cover,
            width: double.infinity, height: double.infinity);
        }
      } catch (_) {}
    }
    if (networkUrl != null) {
      return Image.network(networkUrl, fit: BoxFit.cover,
        width: double.infinity, height: double.infinity,
        loadingBuilder: (_, child, progress) =>
          progress == null ? child : const ColoredBox(color: Color(0xFF1E293B)),
        errorBuilder: (_, __, ___) =>
          const Icon(Icons.broken_image, color: Colors.white38));
    }
    return const ColoredBox(color: Color(0xFF1E293B));
  }

  Widget _photoChip(String label, bool filled, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: filled ? color.withValues(alpha: 0.15) : Colors.transparent,
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: filled ? color : const Color(0x1AFFFFFF))),
      child: Text('작업$label', style: TextStyle(
        color: filled ? color : const Color(0x33FFFFFF),
        fontSize: 12, fontWeight: filled ? FontWeight.bold : FontWeight.normal)));
  }

  Widget _photoChipSmall(String label, bool filled, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: filled ? color.withValues(alpha: 0.15) : Colors.transparent,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: filled ? color : const Color(0x1AFFFFFF))),
      child: Text(label, style: TextStyle(
        color: filled ? color : const Color(0x33FFFFFF),
        fontSize: 10, fontWeight: filled ? FontWeight.bold : FontWeight.normal)));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build
  // ─────────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final ok = await _onWillPop();
        if (ok && mounted) Navigator.of(context).pop();
      },
      child: switch (_mode) {
        _Mode.list     => _buildListView(),
        _Mode.review   => _buildReviewView(),
        _Mode.approval => _buildApprovalView(),
        _Mode.complete => _buildCompleteView(),
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Spot detail page — scrollable before/during/after photo comparison
// ─────────────────────────────────────────────────────────────────────────────

class _SpotDetailPage extends StatefulWidget {
  final WorkSpot     spot;
  final String       jobId;
  final VoidCallback onNavigate;

  const _SpotDetailPage({
    required this.spot,
    required this.jobId,
    required this.onNavigate,
  });

  @override
  State<_SpotDetailPage> createState() => _SpotDetailPageState();
}

class _SpotDetailPageState extends State<_SpotDetailPage> {
  bool _savingNote      = false;
  bool _addingExtraPhoto = false;

  String _fmt(DateTime dt) =>
      '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';

  Future<void> _saveExtraPhotos() async {
    try {
      await FirebaseFirestore.instance
          .collection('projects').doc(widget.jobId)
          .set({
            'arSpots': {
              widget.spot.id: {
                'extraPhotos': widget.spot.extraPhotos.map((e) => e.toMap()).toList(),
              }
            }
          }, SetOptions(merge: true));
    } catch (e) {
      debugPrint('[ExtraPhotos] 저장 오류: $e');
    }
  }

  Future<void> _uploadExtraPhoto(_ExtraPhoto ep) async {
    if (mounted) setState(() => ep._uploading = true);
    try {
      final file = File(ep.localPath!);
      final bytes = await file.readAsBytes();
      String? url;
      // 재시도 최대 4회
      for (int attempt = 1; attempt <= 4; attempt++) {
        try {
          final ref = FirebaseStorage.instance
              .ref('ar_photos/${widget.jobId}/${widget.spot.id}/${ep.id}.jpg');
          await ref.putData(bytes, SettableMetadata(contentType: 'image/jpeg'));
          url = await ref.getDownloadURL();
          break;
        } catch (e) {
          debugPrint('[ExtraPhoto] 업로드 시도 $attempt 실패: $e');
          if (attempt < 4) await Future.delayed(Duration(seconds: attempt * 3));
        }
      }
      if (url != null) {
        ep.url = url;
        ep._failed = false;
        if (mounted) setState(() {});
        await _saveExtraPhotos();
      } else {
        ep._failed = true;
        if (mounted) setState(() {});
      }
    } catch (e) {
      ep._failed = true;
      if (mounted) setState(() {});
      debugPrint('[ExtraPhoto] 업로드 오류: $e');
    } finally {
      ep._uploading = false;
      if (mounted) setState(() {});
    }
  }

  Future<void> _captureExtraPhoto() async {
    if (_addingExtraPhoto) return;
    setState(() => _addingExtraPhoto = true);
    try {
      final path = await Navigator.push<String>(
        context,
        MaterialPageRoute(builder: (_) => const _CameraCapturePage(
          session: _Session.during,
          spotName: '',
        )),
      );
      if (path == null || !mounted) return;
      final bytes = await FlutterImageCompress.compressWithFile(
          path, quality: 82, minWidth: 1280, minHeight: 960);
      if (bytes == null) return;
      final id = 'extra_${DateTime.now().millisecondsSinceEpoch}';
      final docsDir = await getApplicationDocumentsDirectory();
      final localPath = '${docsDir.path}/${widget.spot.id}_$id.jpg';
      await File(localPath).writeAsBytes(bytes);
      final ep = _ExtraPhoto(id: id, localPath: localPath);
      setState(() => widget.spot.extraPhotos.add(ep));
      await _saveExtraPhotos();
      _uploadExtraPhoto(ep);
    } finally {
      if (mounted) setState(() => _addingExtraPhoto = false);
    }
  }

  Future<void> _deleteExtraPhoto(_ExtraPhoto ep) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('사진 삭제',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: const Text('이 작업 사진을 삭제하시겠습니까?',
            style: TextStyle(color: Color(0xCCFFFFFF))),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('취소', style: TextStyle(color: Colors.white54))),
          ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
              child: const Text('삭제')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    if (ep.url != null) {
      try {
        await FirebaseStorage.instance
            .ref('ar_photos/${widget.jobId}/${widget.spot.id}/${ep.id}.jpg')
            .delete();
      } catch (_) {}
    }
    setState(() => widget.spot.extraPhotos.remove(ep));
    await _saveExtraPhotos();
  }

  Future<void> _editNote() async {
    final ctrl = TextEditingController(text: widget.spot.note ?? '');
    final saved = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('현장 메모',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          maxLines: 4,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: const InputDecoration(
            hintText: '특이사항 입력\n(예: 파이프 누수, 추가 청소 필요)',
            hintStyle: TextStyle(color: Color(0x4DFFFFFF), fontSize: 13),
            filled: true,
            fillColor: Color(0x1AFFFFFF),
            border: OutlineInputBorder(borderSide: BorderSide(color: Color(0x1AFFFFFF))),
            focusedBorder: OutlineInputBorder(
              borderSide: BorderSide(color: Color(0xFF14B8A6))),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('취소', style: TextStyle(color: Colors.white54))),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF14B8A6), foregroundColor: Colors.white),
            child: const Text('저장')),
        ],
      ),
    );
    if (saved == null || !mounted) return;
    setState(() {
      _savingNote = true;
      widget.spot.note = saved.isEmpty ? null : saved;
    });
    try {
      await FirebaseFirestore.instance
          .collection('projects').doc(widget.jobId)
          .set({'arSpots': {widget.spot.id: {'note': widget.spot.note}}},
               SetOptions(merge: true));
    } catch (e) {
      debugPrint('[Note] 저장 오류: $e');
    } finally {
      if (mounted) setState(() => _savingNote = false);
    }
  }

  Widget _photoWidget(String? localPath, String? networkUrl) {
    if (localPath != null) {
      try {
        if (File(localPath).existsSync()) {
          return Image.file(File(localPath), fit: BoxFit.cover,
            width: double.infinity, height: double.infinity);
        }
      } catch (_) {}
    }
    if (networkUrl != null) {
      return Image.network(networkUrl, fit: BoxFit.cover,
        width: double.infinity, height: double.infinity,
        loadingBuilder: (_, child, p) => p == null
            ? child
            : const Center(child: CircularProgressIndicator(color: Colors.white38)),
        errorBuilder: (_, __, ___) => const Center(
          child: Icon(Icons.broken_image_outlined, color: Colors.white38, size: 48)));
    }
    return const ColoredBox(color: Color(0xFF1E293B));
  }

  @override
  Widget build(BuildContext context) {
    final spot = widget.spot;
    final sessions = [
      (_Session.before, spot.beforePhotoPath, spot.beforeUrl),
      (_Session.during, spot.duringPhotoPath, spot.duringUrl),
      (_Session.after,  spot.afterPhotoPath,  spot.afterUrl),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            backgroundColor: const Color(0xFF1E293B),
            foregroundColor: Colors.white,
            pinned: true,
            title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(spot.name,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
              Row(children: [
                Text('사진 ${spot.photoCount}/3장',
                  style: const TextStyle(color: Color(0x8AFFFFFF), fontSize: 11)),
                if (spot.durationLabel != null) ...[
                  const Text(' · ', style: TextStyle(color: Color(0x4DFFFFFF), fontSize: 11)),
                  const Icon(Icons.timer_outlined, color: Color(0xFFF59E0B), size: 11),
                  const SizedBox(width: 2),
                  Text(spot.durationLabel!,
                    style: const TextStyle(color: Color(0xFFF59E0B), fontSize: 11)),
                ],
              ]),
            ]),
            actions: [
              IconButton(
                icon: _savingNote
                    ? const SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white54))
                    : const Icon(Icons.edit_note, color: Color(0xFF7DD3FC), size: 26),
                tooltip: '현장 메모',
                onPressed: _savingNote ? null : _editNote,
              ),
              if (spot.lat != null)
                IconButton(
                  icon: const Icon(Icons.navigation, color: Color(0xFFFEE500), size: 26),
                  tooltip: '현장으로 이동',
                  onPressed: widget.onNavigate,
                ),
              const SizedBox(width: 4),
            ],
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // ── 소요시간 카드
                if (spot.workDuration != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 14),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.35))),
                    child: Row(children: [
                      const Icon(Icons.timer_outlined, color: Color(0xFFF59E0B), size: 22),
                      const SizedBox(width: 12),
                      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('작업 소요시간',
                          style: TextStyle(color: Color(0x8AFFFFFF), fontSize: 11)),
                        Text(spot.durationLabel!,
                          style: const TextStyle(
                            color: Color(0xFFF59E0B), fontWeight: FontWeight.bold, fontSize: 20)),
                      ]),
                      const Spacer(),
                      if (spot.startedAt != null)
                        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                          Text('시작 ${_fmt(spot.startedAt!)}',
                            style: const TextStyle(color: Color(0x4DFFFFFF), fontSize: 10)),
                          Text('완료 ${_fmt(spot.completedAt!)}',
                            style: const TextStyle(color: Color(0x4DFFFFFF), fontSize: 10)),
                        ]),
                    ]),
                  ),
                // ── 메모 카드
                GestureDetector(
                  onTap: _editNote,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 14),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: spot.note != null
                          ? const Color(0x557DD3FC)
                          : const Color(0x1AFFFFFF))),
                    child: Row(children: [
                      Icon(Icons.notes, color: spot.note != null
                          ? const Color(0xFF7DD3FC) : const Color(0x33FFFFFF), size: 18),
                      const SizedBox(width: 10),
                      Expanded(child: spot.note != null
                          ? Text(spot.note!,
                              style: const TextStyle(
                                color: Color(0xCCFFFFFF), fontSize: 13, height: 1.5))
                          : const Text('메모 없음 · 탭하여 입력',
                              style: TextStyle(color: Color(0x4DFFFFFF), fontSize: 13))),
                      const Icon(Icons.edit, color: Color(0x4DFFFFFF), size: 14),
                    ]),
                  ),
                ),
                // ── 전/중/후 사진 카드
                ...sessions.map((entry) {
                  final session    = entry.$1;
                  final localPath  = entry.$2;
                  final networkUrl = entry.$3;
                  final hasPhoto    = localPath != null || networkUrl != null;
                  final isUploading = hasPhoto && networkUrl == null;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 20),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                          decoration: BoxDecoration(
                            color: session.color.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: session.color)),
                          child: Text(session.label,
                            style: TextStyle(color: session.color,
                              fontWeight: FontWeight.bold, fontSize: 13))),
                        const SizedBox(width: 10),
                        if (isUploading) ...[
                          const SizedBox(width: 12, height: 12,
                            child: CircularProgressIndicator(strokeWidth: 1.5,
                              color: Color(0xFF7DD3FC))),
                          const SizedBox(width: 6),
                          const Text('업로드 중...',
                            style: TextStyle(color: Color(0xFF7DD3FC), fontSize: 11)),
                        ] else if (networkUrl != null)
                          const Row(children: [
                            Icon(Icons.cloud_done, color: Color(0xFF14B8A6), size: 14),
                            SizedBox(width: 4),
                            Text('서버 저장 완료',
                              style: TextStyle(color: Color(0xFF14B8A6), fontSize: 11)),
                          ])
                        else
                          const Text('미촬영',
                            style: TextStyle(color: Color(0x4DFFFFFF), fontSize: 11)),
                      ]),
                      const SizedBox(height: 10),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(14),
                        child: AspectRatio(
                          aspectRatio: 4 / 3,
                          child: hasPhoto
                              ? _photoWidget(localPath, networkUrl)
                              : Container(
                                  color: const Color(0xFF1E293B),
                                  child: Center(child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.photo_camera_outlined,
                                        color: session.color.withValues(alpha: 0.3), size: 56),
                                      const SizedBox(height: 8),
                                      Text('${session.label} 사진 미촬영',
                                        style: const TextStyle(
                                          color: Color(0x4DFFFFFF), fontSize: 13)),
                                    ]))),
                        ),
                      ),
                    ]),
                  );
                }),
                // ── 추가 작업 사진 섹션
                Container(
                  margin: const EdgeInsets.only(top: 8),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      const Icon(Icons.photo_library_outlined,
                          color: Color(0xFFE2E8F0), size: 18),
                      const SizedBox(width: 8),
                      const Text('추가 작업 사진',
                          style: TextStyle(
                              color: Color(0xFFE2E8F0),
                              fontSize: 14, fontWeight: FontWeight.bold)),
                      const SizedBox(width: 8),
                      if (spot.extraPhotos.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                              color: const Color(0x1A7DD3FC),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0x557DD3FC))),
                          child: Text('${spot.extraPhotos.length}장',
                              style: const TextStyle(
                                  color: Color(0xFF7DD3FC), fontSize: 11))),
                      const Spacer(),
                      GestureDetector(
                        onTap: _addingExtraPhoto ? null : _captureExtraPhoto,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                              color: const Color(0x1A7DD3FC),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0x557DD3FC))),
                          child: _addingExtraPhoto
                              ? const SizedBox(width: 16, height: 16,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 1.5, color: Color(0xFF7DD3FC)))
                              : const Row(mainAxisSize: MainAxisSize.min, children: [
                                  Icon(Icons.add_a_photo_outlined,
                                      color: Color(0xFF7DD3FC), size: 16),
                                  SizedBox(width: 6),
                                  Text('사진 추가',
                                      style: TextStyle(
                                          color: Color(0xFF7DD3FC), fontSize: 13,
                                          fontWeight: FontWeight.w600)),
                                ]),
                        ),
                      ),
                    ]),
                    const SizedBox(height: 12),
                    if (spot.extraPhotos.isEmpty)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 28),
                        decoration: BoxDecoration(
                            color: const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0x1AFFFFFF),
                                style: BorderStyle.solid)),
                        child: const Column(mainAxisSize: MainAxisSize.min, children: [
                          Icon(Icons.add_photo_alternate_outlined,
                              color: Color(0x4DFFFFFF), size: 40),
                          SizedBox(height: 8),
                          Text('추가 사진 없음',
                              style: TextStyle(color: Color(0x4DFFFFFF), fontSize: 13)),
                          Text('위의 버튼으로 작업 사진을 추가하세요',
                              style: TextStyle(color: Color(0x33FFFFFF), fontSize: 11)),
                        ]),
                      )
                    else
                      GridView.builder(
                        physics: const NeverScrollableScrollPhysics(),
                        shrinkWrap: true,
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 3,
                            crossAxisSpacing: 8,
                            mainAxisSpacing: 8,
                            childAspectRatio: 1),
                        itemCount: spot.extraPhotos.length,
                        itemBuilder: (_, i) {
                          final ep = spot.extraPhotos[i];
                          return Stack(children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: _photoWidget(ep.localPath, ep.url),
                            ),
                            // 업로드 상태 배지 (하단)
                            Positioned(bottom: 4, left: 4,
                              child: ep._uploading
                                ? Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                    decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(6)),
                                    child: const Row(mainAxisSize: MainAxisSize.min, children: [
                                      SizedBox(width: 8, height: 8,
                                        child: CircularProgressIndicator(strokeWidth: 1.2, color: Color(0xFF7DD3FC))),
                                      SizedBox(width: 4),
                                      Text('전송중', style: TextStyle(color: Color(0xFF7DD3FC), fontSize: 9)),
                                    ]))
                                : ep._failed
                                  ? Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                      decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(6)),
                                      child: const Row(mainAxisSize: MainAxisSize.min, children: [
                                        Icon(Icons.wifi_off, color: Colors.orange, size: 9),
                                        SizedBox(width: 3),
                                        Text('재시도중', style: TextStyle(color: Colors.orange, fontSize: 9)),
                                      ]))
                                  : ep.url != null
                                    ? Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                        decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(6)),
                                        child: const Row(mainAxisSize: MainAxisSize.min, children: [
                                          Icon(Icons.cloud_done, color: Color(0xFF14B8A6), size: 9),
                                          SizedBox(width: 3),
                                          Text('저장완료', style: TextStyle(color: Color(0xFF14B8A6), fontSize: 9)),
                                        ]))
                                    : const SizedBox.shrink()),
                            // 삭제 버튼 (우상단)
                            Positioned(top: 4, right: 4,
                              child: GestureDetector(
                                onTap: () => _deleteExtraPhoto(ep),
                                child: Container(
                                  width: 26, height: 26,
                                  decoration: const BoxDecoration(color: Colors.black87, shape: BoxShape.circle),
                                  child: const Icon(Icons.close, color: Colors.white, size: 16)))),
                          ]);
                        },
                      ),
                  ]),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// In-app compass walking navigator — 100m 이내 현장 내 도보 안내
// ─────────────────────────────────────────────────────────────────────────────

class _SpotCompassPage extends StatefulWidget {
  final WorkSpot     spot;
  final VoidCallback onExternalNav; // KakaoNavi 외부 앱 폴백

  const _SpotCompassPage({required this.spot, required this.onExternalNav});

  @override
  State<_SpotCompassPage> createState() => _SpotCompassPageState();
}

class _SpotCompassPageState extends State<_SpotCompassPage>
    with TickerProviderStateMixin {

  StreamSubscription<MagnetometerEvent>? _magSub;
  StreamSubscription<Position>?          _gpsSub;
  Timer?                                 _guidanceTimer;
  late final FlutterTts                  _tts;
  late final AnimationController         _pulseCtrl;

  double?   _heading;       // 자기계 기준 기기 방향 (0–360°)
  Position? _currentPos;    // 실시간 GPS
  bool      _gpsSearching = true;
  bool      _arrived      = false;

  String?   _lastSpoken;
  DateTime? _lastSpokenAt;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))
      ..repeat(reverse: true);
    _initTts().then((_) {
      _tts.speak('${widget.spot.name} 방향으로 이동하세요. GPS 신호를 탐색합니다.');
    });
    _startStreams();
  }

  @override
  void dispose() {
    _magSub?.cancel();
    _gpsSub?.cancel();
    _guidanceTimer?.cancel();
    _tts.stop();
    _pulseCtrl.dispose();
    super.dispose();
  }

  Future<void> _initTts() async {
    _tts = FlutterTts();
    await _tts.setLanguage('ko-KR');
    await _tts.setVolume(1.0);
    // 속도는 시스템 기본값(자연스러운 속도) 사용
  }

  Future<void> _speak(String text) async {
    final now = DateTime.now();
    if (_lastSpoken == text &&
        _lastSpokenAt != null &&
        now.difference(_lastSpokenAt!).inSeconds < 10) return;
    if (_lastSpokenAt != null && now.difference(_lastSpokenAt!).inSeconds < 5) return;
    _lastSpoken   = text;
    _lastSpokenAt = now;
    await _tts.speak(text);
  }

  void _startStreams() {
    // 자기계 → 기기 방향
    try {
      _magSub = magnetometerEvents.listen((e) {
        final h = (atan2(e.y, e.x) * 180 / pi + 360) % 360;
        if (mounted) setState(() => _heading = h);
      });
    } catch (_) {}

    // GPS 스트림
    Geolocator.checkPermission().then((perm) {
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) return;
      _gpsSub = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high, distanceFilter: 2),
      ).listen((pos) {
        if (!mounted) return;
        setState(() { _currentPos = pos; _gpsSearching = false; });
        _onPositionUpdate(pos);
      });
    });

    // 주기적 TTS 안내 (12초마다)
    _guidanceTimer = Timer.periodic(const Duration(seconds: 12), (_) => _maybeSpeak());
  }

  double _distM(double lat1, double lng1, double lat2, double lng2) {
    const r = 6371000.0;
    final dLat = (lat2 - lat1) * pi / 180;
    final dLng = (lng2 - lng1) * pi / 180;
    final a = sin(dLat / 2) * sin(dLat / 2) +
              cos(lat1 * pi / 180) * cos(lat2 * pi / 180) *
              sin(dLng / 2) * sin(dLng / 2);
    return r * 2 * atan2(sqrt(a), sqrt(1 - a));
  }

  double _bearingTo(double lat1, double lng1, double lat2, double lng2) {
    final dLng = (lng2 - lng1) * pi / 180;
    final lat1r = lat1 * pi / 180, lat2r = lat2 * pi / 180;
    final y = sin(dLng) * cos(lat2r);
    final x = cos(lat1r) * sin(lat2r) - sin(lat1r) * cos(lat2r) * cos(dLng);
    return (atan2(y, x) * 180 / pi + 360) % 360;
  }

  String _dirText(double relBearing) {
    if (relBearing < 22.5 || relBearing >= 337.5) return '전방';
    if (relBearing < 67.5)  return '우전방';
    if (relBearing < 112.5) return '우측';
    if (relBearing < 157.5) return '우후방';
    if (relBearing < 202.5) return '뒤쪽';
    if (relBearing < 247.5) return '좌후방';
    if (relBearing < 292.5) return '좌측';
    return '좌전방';
  }

  void _onPositionUpdate(Position pos) {
    if (widget.spot.lat == null) return;
    final dist = _distM(pos.latitude, pos.longitude, widget.spot.lat!, widget.spot.lng!);

    if (dist < 5 && !_arrived) {
      setState(() => _arrived = true);
      HapticFeedback.heavyImpact();
      _tts.speak('${widget.spot.name}에 도착하였습니다');
      return;
    }
    if (dist < 15) HapticFeedback.mediumImpact();
  }

  void _maybeSpeak() {
    final pos = _currentPos;
    if (pos == null || widget.spot.lat == null || _arrived) return;
    final dist    = _distM(pos.latitude, pos.longitude, widget.spot.lat!, widget.spot.lng!);
    final bearing = _bearingTo(pos.latitude, pos.longitude, widget.spot.lat!, widget.spot.lng!);
    final rel     = _heading != null ? ((bearing - _heading! + 360) % 360) : null;
    final dir     = rel != null ? _dirText(rel) : '';

    final distStr = dist < 10
        ? '${dist.round()}미터'
        : dist < 100
            ? '${((dist / 5).round() * 5).toInt()}미터'
            : '${((dist / 10).round() * 10).toInt()}미터';

    _speak(dir.isNotEmpty ? '$dir $distStr 앞입니다' : '$distStr 앞입니다');
  }

  double? get _relBearing {
    final pos = _currentPos;
    if (pos == null || widget.spot.lat == null || _heading == null) return null;
    final bearing = _bearingTo(pos.latitude, pos.longitude, widget.spot.lat!, widget.spot.lng!);
    return (bearing - _heading! + 360) % 360;
  }

  double get _distNow {
    final pos = _currentPos;
    if (pos == null || widget.spot.lat == null) return double.infinity;
    return _distM(pos.latitude, pos.longitude, widget.spot.lat!, widget.spot.lng!);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(child: Column(children: [
        _buildHeader(),
        Expanded(child: _arrived ? _buildArrived() : _buildNavigating()),
      ])),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(4, 6, 12, 6),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0x1AFFFFFF)))),
      child: Row(children: [
        IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 22),
          onPressed: () => Navigator.of(context).pop()),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(widget.spot.name,
            style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
            overflow: TextOverflow.ellipsis),
          const Text('앱 내 도보 안내', style: TextStyle(color: Color(0x61FFFFFF), fontSize: 11)),
        ])),
        // 외부 앱 안내 폴백
        GestureDetector(
          onTap: () { Navigator.of(context).pop(); widget.onExternalNav(); },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFFEE500).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFFEE500).withValues(alpha: 0.4))),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.navigation, color: Color(0xFFFEE500), size: 14),
              SizedBox(width: 4),
              Text('카카오 앱', style: TextStyle(color: Color(0xFFFEE500), fontSize: 11, fontWeight: FontWeight.bold)),
            ]),
          ),
        ),
      ]),
    );
  }

  Widget _buildNavigating() {
    final dist = _distNow;
    final rel  = _relBearing;
    final pos  = _currentPos;

    final distColor = dist < 15
        ? const Color(0xFF14B8A6)
        : dist < 50
            ? const Color(0xFFF59E0B)
            : Colors.white;

    return Column(children: [
      const SizedBox(height: 28),

      // ── 거리 수치
      if (!_gpsSearching && pos != null)
        Column(children: [
          Text(
            dist.isInfinite ? '–'
                : dist < 1000 ? '${dist.toStringAsFixed(0)} m'
                : '${(dist / 1000).toStringAsFixed(1)} km',
            style: TextStyle(color: distColor, fontSize: 64,
              fontWeight: FontWeight.w900, letterSpacing: -2, height: 1.0)),
          const SizedBox(height: 6),
          Text(
            rel != null ? _dirText(rel) : '방향 산출 중...',
            style: TextStyle(color: distColor.withValues(alpha: 0.7), fontSize: 20, fontWeight: FontWeight.w600)),
        ])
      else
        Column(children: [
          AnimatedBuilder(
            animation: _pulseCtrl,
            builder: (_, __) => Opacity(
              opacity: 0.4 + 0.6 * _pulseCtrl.value,
              child: const Icon(Icons.gps_not_fixed, color: Color(0xFF7DD3FC), size: 48))),
          const SizedBox(height: 12),
          const Text('GPS 신호 탐색 중...', style: TextStyle(color: Color(0xFF7DD3FC), fontSize: 16)),
        ]),

      const SizedBox(height: 24),

      // ── 나침반 화살표
      Expanded(child: Center(child:
        rel != null
            ? AnimatedRotation(
                turns: rel / 360,
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeOut,
                child: CustomPaint(
                  size: const Size(200, 200),
                  painter: _ArrowPainter(color: distColor)))
            : AnimatedBuilder(
                animation: _pulseCtrl,
                builder: (_, __) => Opacity(
                  opacity: 0.3 + 0.5 * _pulseCtrl.value,
                  child: CustomPaint(
                    size: const Size(200, 200),
                    painter: _ArrowPainter(color: const Color(0x3D7DD3FC)))))
      )),

      // ── GPS 정확도
      if (pos != null)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Row(children: [
            Icon(
              pos.accuracy <= 10 ? Icons.gps_fixed : Icons.gps_not_fixed,
              size: 12,
              color: pos.accuracy <= 10
                  ? const Color(0xFF14B8A6)
                  : pos.accuracy <= 20 ? Colors.orange : Colors.redAccent),
            const SizedBox(width: 5),
            Text('GPS 정확도 ±${pos.accuracy.toStringAsFixed(0)}m',
              style: TextStyle(
                color: pos.accuracy <= 10
                    ? const Color(0xFF14B8A6)
                    : pos.accuracy <= 20 ? Colors.orange : Colors.redAccent,
                fontSize: 11)),
            const Spacer(),
            if (pos.accuracy > 20)
              const Text('정확도 낮음 · 야외 이동 권장',
                style: TextStyle(color: Colors.orange, fontSize: 10)),
          ])),

      const SizedBox(height: 12),

      // ── 목적지 사진 섬네일
      if (widget.spot.beforePhotoPath != null || widget.spot.beforeUrl != null)
        Container(
          margin: const EdgeInsets.fromLTRB(20, 0, 20, 8),
          height: 90,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0x1AFFFFFF))),
          clipBehavior: Clip.hardEdge,
          child: Stack(fit: StackFit.expand, children: [
            widget.spot.beforePhotoPath != null
                ? Image.file(File(widget.spot.beforePhotoPath!), fit: BoxFit.cover)
                : Image.network(widget.spot.beforeUrl!, fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const ColoredBox(color: Color(0xFF1E293B))),
            const Positioned(bottom: 0, left: 0, right: 0,
              child: ColoredBox(color: Color(0x88000000),
                child: Padding(padding: EdgeInsets.all(6),
                  child: Text('목적지 작업전 사진', style: TextStyle(color: Colors.white70, fontSize: 10))))),
          ]),
        ),

      const SizedBox(height: 16),
    ]);
  }

  Widget _buildArrived() {
    return Center(child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.location_on, color: Color(0xFF14B8A6), size: 100),
        const SizedBox(height: 20),
        const Text('도착!',
          style: TextStyle(color: Colors.white, fontSize: 52, fontWeight: FontWeight.bold, height: 1.0)),
        const SizedBox(height: 10),
        Text(widget.spot.name,
          style: const TextStyle(color: Color(0xFF7DD3FC), fontSize: 22),
          textAlign: TextAlign.center),
        const SizedBox(height: 40),
        SizedBox(width: double.infinity,
          child: ElevatedButton(
            onPressed: () => Navigator.of(context).pop(),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF14B8A6),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
            child: const Text('촬영 화면으로 돌아가기',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)))),
      ]),
    ));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 나침반 화살표 CustomPainter
// ─────────────────────────────────────────────────────────────────────────────

class _ArrowPainter extends CustomPainter {
  final Color color;
  const _ArrowPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2, cy = size.height / 2, r = size.width / 2;
    final paint = Paint()..style = PaintingStyle.fill;

    // 외부 링
    paint
      ..color = color.withValues(alpha: 0.18)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5;
    canvas.drawCircle(Offset(cx, cy), r * 0.96, paint);
    paint.style = PaintingStyle.fill;

    // 화살표 몸체 (위로 향하는 방향이 0° = 전방)
    paint.color = color;
    final body = Path()
      ..moveTo(cx, cy - r * 0.88)          // 끝점
      ..lineTo(cx + r * 0.40, cy + r * 0.10) // 오른쪽 어깨
      ..lineTo(cx + r * 0.16, cy - r * 0.02) // 오른쪽 안쪽
      ..lineTo(cx + r * 0.16, cy + r * 0.88) // 오른쪽 꼬리
      ..lineTo(cx - r * 0.16, cy + r * 0.88) // 왼쪽 꼬리
      ..lineTo(cx - r * 0.16, cy - r * 0.02) // 왼쪽 안쪽
      ..lineTo(cx - r * 0.40, cy + r * 0.10) // 왼쪽 어깨
      ..close();
    canvas.drawPath(body, paint);

    // 끝점 하이라이트
    paint.color = Colors.white.withValues(alpha: 0.35);
    final tip = Path()
      ..moveTo(cx, cy - r * 0.88)
      ..lineTo(cx + r * 0.14, cy - r * 0.30)
      ..lineTo(cx, cy - r * 0.10)
      ..lineTo(cx - r * 0.14, cy - r * 0.30)
      ..close();
    canvas.drawPath(tip, paint);

    // 중심 원
    paint.color = Colors.white.withValues(alpha: 0.25);
    canvas.drawCircle(Offset(cx, cy), r * 0.10, paint);
  }

  @override
  bool shouldRepaint(_ArrowPainter old) => old.color != color;
}

// ─────────────────────────────────────────────────────────────────────────────
// Isolated camera capture page — owns its own CameraController lifecycle
// ─────────────────────────────────────────────────────────────────────────────

class _CameraCapturePage extends StatefulWidget {
  final _Session session;
  final String   spotName;
  final String?  ghostLocalPath;   // 작업전 사진 로컬 경로 (중/후 촬영 시 오버랩)
  final String?  ghostNetworkUrl;  // 작업전 사진 서버 URL

  const _CameraCapturePage({
    required this.session,
    required this.spotName,
    this.ghostLocalPath,
    this.ghostNetworkUrl,
  });

  @override
  State<_CameraCapturePage> createState() => _CCPageState();
}

class _CCPageState extends State<_CameraCapturePage> {
  CameraController? _ctrl;
  bool   _ready        = false;
  bool   _initializing = false;
  String _error        = '';
  bool   _capturing    = false;

  bool   _timerActive = false;
  int    _timerCount  = 3;
  Timer? _countdown;

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _countdown?.cancel();
    _ctrl?.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    if (_initializing || !mounted) return;
    _initializing = true;
    if (mounted) setState(() { _error = ''; _ready = false; });
    try {
      var perm = await Permission.camera.status;
      if (!perm.isGranted) perm = await Permission.camera.request();
      if (!perm.isGranted) {
        if (mounted) setState(() => _error = '카메라 권한이 없습니다');
        return;
      }
      final cams = await availableCameras();
      if (!mounted) return;
      if (cams.isEmpty) {
        if (mounted) setState(() => _error = '사용 가능한 카메라가 없습니다');
        return;
      }
      final back = cams.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cams.first,
      );
      final ctrl = CameraController(back, ResolutionPreset.medium, enableAudio: false);
      await ctrl.initialize();
      if (!mounted) { ctrl.dispose(); return; }
      setState(() { _ctrl = ctrl; _ready = true; });
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      _initializing = false;
    }
  }

  Future<void> _capture() async {
    if (_capturing || !_ready || _ctrl == null) return;
    setState(() => _capturing = true);
    HapticFeedback.mediumImpact();
    try {
      final xfile = await _ctrl!.takePicture();
      if (mounted) Navigator.of(context).pop(xfile.path);
    } catch (e) {
      if (mounted) {
        setState(() => _capturing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('촬영 오류: $e'), backgroundColor: Colors.red));
      }
    }
  }

  void _startTimer() {
    if (_timerActive || _capturing) return;
    HapticFeedback.lightImpact();
    setState(() { _timerActive = true; _timerCount = 3; });
    _countdown = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) { t.cancel(); return; }
      if (_timerCount > 1) {
        setState(() => _timerCount--);
        HapticFeedback.lightImpact();
      } else {
        t.cancel();
        setState(() { _timerActive = false; _timerCount = 3; });
        _capture();
      }
    });
  }

  void _cancelTimer() {
    _countdown?.cancel();
    if (mounted) setState(() { _timerActive = false; _timerCount = 3; });
  }

  // ghost 사진 위젯 (작업전 사진 오버랩)
  Widget _ghostWidget() {
    final localPath = widget.ghostLocalPath;
    final netUrl    = widget.ghostNetworkUrl;
    if (localPath != null) {
      try {
        if (File(localPath).existsSync()) {
          return Image.file(File(localPath), fit: BoxFit.cover,
            width: double.infinity, height: double.infinity);
        }
      } catch (_) {}
    }
    if (netUrl != null) {
      return Image.network(netUrl, fit: BoxFit.cover,
        width: double.infinity, height: double.infinity,
        loadingBuilder: (_, child, p) => p == null ? child : const SizedBox.shrink(),
        errorBuilder: (_, __, ___) => const SizedBox.shrink());
    }
    return const SizedBox.shrink();
  }

  @override
  Widget build(BuildContext context) {
    final color    = widget.session.color;
    final hasGhost = widget.ghostLocalPath != null || widget.ghostNetworkUrl != null;
    final top      = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(children: [

        // ── Camera preview
        if (_ready && _ctrl != null && _ctrl!.value.isInitialized)
          Positioned.fill(child: CameraPreview(_ctrl!))
        else
          Center(child: _error.isEmpty
            ? const Column(mainAxisSize: MainAxisSize.min, children: [
                CircularProgressIndicator(color: Colors.white),
                SizedBox(height: 12),
                Text('카메라 연결 중...', style: TextStyle(color: Colors.white54, fontSize: 14)),
              ])
            : Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.error_outline, color: Colors.red, size: 48),
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Text(_error,
                    style: const TextStyle(color: Colors.yellow, fontSize: 11),
                    textAlign: TextAlign.center)),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed: _init,
                  icon: const Icon(Icons.refresh),
                  label: const Text('재시도')),
              ])),

        // ── Ghost overlay (작업전 사진 35% 반투명 오버랩)
        if (hasGhost)
          Positioned.fill(child: IgnorePointer(child: Opacity(
            opacity: 0.35,
            child: _ghostWidget(),
          ))),

        // ── Countdown overlay
        if (_timerActive)
          Positioned.fill(child: Container(
            color: Colors.black54,
            child: Center(child: Text('$_timerCount',
              style: const TextStyle(color: Colors.white, fontSize: 140,
                fontWeight: FontWeight.bold,
                shadows: [Shadow(blurRadius: 30, color: Color(0xFF14B8A6))]))),
          )),

        // ── Top panel
        Positioned(top: 0, left: 0, right: 0, child: Container(
          padding: EdgeInsets.fromLTRB(14, top + 10, 14, 16),
          decoration: const BoxDecoration(gradient: LinearGradient(
            begin: Alignment.topCenter, end: Alignment.bottomCenter,
            colors: [Colors.black, Colors.transparent])),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            // 세션 진행 탭 (전/중/후)
            Row(mainAxisAlignment: MainAxisAlignment.center,
              children: _Session.values.map((s) {
                final isActive = s == widget.session;
                return Container(
                  margin: EdgeInsets.only(left: s.index > 0 ? 8 : 0),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
                  decoration: BoxDecoration(
                    color: isActive ? s.color : const Color(0x1AFFFFFF),
                    borderRadius: BorderRadius.circular(8)),
                  child: Text(s.label, style: TextStyle(
                    color: isActive ? Colors.white : const Color(0x4DFFFFFF),
                    fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                    fontSize: 13)));
              }).toList()),
            const SizedBox(height: 10),
            // 장소 정보 패널
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
              decoration: BoxDecoration(
                color: Colors.black87,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: color.withValues(alpha: 0.5))),
              child: Row(children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.2), shape: BoxShape.circle),
                  child: Icon(
                    widget.session == _Session.before
                        ? Icons.add_location : Icons.location_on,
                    color: color, size: 20)),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(widget.spotName,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                    overflow: TextOverflow.ellipsis),
                  Text(
                    widget.session == _Session.before ? '새 장소로 저장됩니다' : '${widget.session.label} 촬영',
                    style: const TextStyle(color: Color(0x61FFFFFF), fontSize: 11)),
                ])),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: color)),
                  child: Text(widget.session.label,
                    style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 13))),
              ]),
            ),
            // ghost 안내 문구
            if (hasGhost)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Icon(Icons.layers, color: Color(0xFF14B8A6), size: 14),
                  const SizedBox(width: 6),
                  Text('작업 전 사진 35% 오버랩 · 구도를 맞춰주세요',
                    style: TextStyle(color: Colors.teal.shade300, fontSize: 12)),
                ])),
          ]),
        )),

        // ── 뒤로 버튼 (우상단 작은 버튼)
        Positioned(
          top: top + 10, right: 14,
          child: GestureDetector(
            onTap: () => Navigator.of(context).pop(null),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(color: Colors.white24, shape: BoxShape.circle),
              child: const Icon(Icons.close, color: Colors.white, size: 22)))),

        // ── Bottom controls
        Positioned(bottom: 30, left: 16, right: 72, child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // 3초 타이머
            GestureDetector(
              onTap: _timerActive ? _cancelTimer : _startTimer,
              child: Container(
                width: 52, height: 52,
                margin: const EdgeInsets.only(right: 16),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _timerActive
                    ? Colors.orange.withValues(alpha: 0.85)
                    : const Color(0x33FFFFFF)),
                child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.timer, color: Colors.white, size: 20),
                  Text('3초', style: TextStyle(color: Colors.white, fontSize: 9)),
                ]))),
            // 셔터 버튼
            _timerActive
              ? GestureDetector(
                  onTap: _cancelTimer,
                  child: Container(
                    width: kCamBtn, height: kCamBtn,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.redAccent.withValues(alpha: 0.9),
                      border: Border.all(color: Colors.red, width: 5)),
                    child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(Icons.stop, color: Colors.white, size: 36),
                      Text('취소', style: TextStyle(color: Colors.white, fontSize: 12)),
                    ])))
              : GestureDetector(
                  onTap: _capturing ? null : _capture,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    width: kCamBtn, height: kCamBtn,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _capturing ? Colors.grey.shade800 : Colors.white,
                      border: Border.all(color: color, width: 5),
                      boxShadow: _capturing ? [] : [
                        BoxShadow(color: color.withValues(alpha: 0.55), blurRadius: 26, spreadRadius: 6)]),
                    child: _capturing
                      ? Padding(padding: const EdgeInsets.all(26),
                          child: CircularProgressIndicator(strokeWidth: 3, color: color))
                      : Icon(Icons.camera_alt, color: color, size: 42))),
          ],
        )),

        // ── 우측 FAB (목록으로)
        Positioned(bottom: 36, right: 14,
          child: GestureDetector(
            onTap: () { _countdown?.cancel(); Navigator.of(context).pop(null); },
            child: Container(
              width: kFabSz, height: kFabSz,
              decoration: BoxDecoration(
                color: const Color(0x44FFFFFF), shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 8)]),
              child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.list, color: Colors.white, size: 26),
                Text('목록', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
              ])))),
      ]),
    );
  }
}
