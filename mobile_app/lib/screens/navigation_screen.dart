import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

class NavigationScreen extends StatefulWidget {
  final String jobName;
  final String address;

  const NavigationScreen({super.key, required this.jobName, required this.address});

  @override
  State<NavigationScreen> createState() => _NavigationScreenState();
}

class _NavigationScreenState extends State<NavigationScreen> {
  bool _copied = false;

  @override
  void initState() {
    super.initState();
    _autoCopy();
  }

  Future<void> _autoCopy() async {
    final addr = widget.address;
    if (addr.isEmpty || addr == '주소 미등록') return;
    await Clipboard.setData(ClipboardData(text: addr));
    if (mounted) setState(() => _copied = true);
  }

  Future<void> _launch(String scheme, String fallback) async {
    final uri = Uri.parse(scheme);
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        return;
      }
    } catch (_) {}
    final fb = Uri.parse(fallback);
    await launchUrl(fb, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final addr = (widget.address.isEmpty || widget.address == '주소 미등록')
        ? '주소 미등록'
        : widget.address;
    final enc = Uri.encodeComponent(addr);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        title: const Text('내비게이션 안내', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0B1C30),
        elevation: 0,
        centerTitle: false,
        iconTheme: const IconThemeData(color: Color(0xFF0B1C30), size: 28),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 작업장 정보
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF005BB7), Color(0xFF00448C)]),
                borderRadius: BorderRadius.circular(18),
                boxShadow: [BoxShadow(color: const Color(0xFF005BB7).withOpacity(0.25), blurRadius: 20, offset: const Offset(0, 8))],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('목적지', style: TextStyle(color: Color(0xFFC4D7FF), fontSize: 13, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  Text(widget.jobName, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900, height: 1.2)),
                  const SizedBox(height: 16),
                  const Divider(color: Color(0x33FFFFFF)),
                  const SizedBox(height: 14),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.location_on, color: Color(0xFF7DD3FC), size: 22),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(addr, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w600, height: 1.4)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        await Clipboard.setData(ClipboardData(text: addr));
                        setState(() => _copied = true);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('주소가 클립보드에 복사되었습니다'),
                              backgroundColor: Color(0xFF16A34A),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        }
                      },
                      icon: Icon(_copied ? Icons.check_circle : Icons.copy, size: 20, color: _copied ? const Color(0xFF4ADE80) : Colors.white70),
                      label: Text(_copied ? '주소 복사됨 ✓' : '주소 복사하기',
                          style: TextStyle(color: _copied ? const Color(0xFF4ADE80) : Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: _copied ? const Color(0xFF4ADE80) : Colors.white38, width: 1.5),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),
            const Text('내비게이션 앱 선택', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
            const SizedBox(height: 14),

            _navBtn(
              label: '카카오맵으로 길 찾기',
              sublabel: '카카오맵 → 경로 안내',
              bgColor: const Color(0xFFFFE600),
              fgColor: const Color(0xFF3C1E1E),
              icon: Icons.map_rounded,
              onTap: () => _launch('kakaomap://search?q=$enc', 'https://map.kakao.com/?q=$enc'),
            ),
            const SizedBox(height: 12),

            _navBtn(
              label: '네이버 지도로 길 찾기',
              sublabel: '네이버 지도 → 경로 안내',
              bgColor: const Color(0xFF03C75A),
              fgColor: Colors.white,
              icon: Icons.navigation_rounded,
              onTap: () => _launch(
                'nmap://search?query=$enc&appname=com.cleancare.app',
                'https://map.naver.com/v5/search/$enc',
              ),
            ),
            const SizedBox(height: 12),

            _navBtn(
              label: '구글 지도로 길 찾기',
              sublabel: '구글 지도 → 경로 안내',
              bgColor: const Color(0xFF4285F4),
              fgColor: Colors.white,
              icon: Icons.assistant_navigation,
              onTap: () => _launch(
                'google.navigation:q=$enc',
                'https://www.google.com/maps/dir/?api=1&destination=$enc',
              ),
            ),
            const SizedBox(height: 12),

            _navBtn(
              label: 'T맵으로 길 찾기',
              sublabel: 'SKT T맵 → 경로 안내',
              bgColor: const Color(0xFFE8003D),
              fgColor: Colors.white,
              icon: Icons.near_me_rounded,
              onTap: () => _launch('tmap://search?name=$enc', 'https://tmap.co.kr'),
            ),

            const SizedBox(height: 32),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF9E5),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFFD60A).withOpacity(0.4)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, color: Color(0xFF92400E), size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      '주소가 자동으로 클립보드에 복사되었습니다.\n앱이 없으면 직접 붙여넣기로 주소를 입력하세요.',
                      style: TextStyle(color: Color(0xFF92400E), fontSize: 13, height: 1.5),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _navBtn({
    required String label,
    required String sublabel,
    required Color bgColor,
    required Color fgColor,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return SizedBox(
      width: double.infinity,
      height: 72,
      child: ElevatedButton(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: bgColor,
          elevation: 2,
          shadowColor: bgColor.withOpacity(0.4),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          padding: const EdgeInsets.symmetric(horizontal: 20),
        ),
        child: Row(
          children: [
            Icon(icon, size: 30, color: fgColor),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: fgColor)),
                  const SizedBox(height: 2),
                  Text(sublabel, style: TextStyle(fontSize: 12, color: fgColor.withOpacity(0.7))),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios, size: 16, color: fgColor.withOpacity(0.6)),
          ],
        ),
      ),
    );
  }
}
