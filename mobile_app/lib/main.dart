import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import 'screens/login_screen.dart';
import 'screens/ar_camera_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp(); // firebase_options.dart 없이도 웹에서는 진행되거나 catch됨
  } catch (e) {
    debugPrint('Firebase init failed (test mode fallback active): $e');
  }
  runApp(const CleanCareApp());
}

class CleanCareApp extends StatelessWidget {
  const CleanCareApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '크린케어 현장팀',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF14B8A6), // 브랜드 틸 컬러 (로고 색상)
          primary: const Color(0xFF2563EB),   // 브랜드 블루
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        fontFamily: 'Roboto',
      ),
      home: const WorkerHomeScreen(), // 테스트를 위해 임시로 홈 스크린으로 직행
    );
  }
}

// 작업자 홈 화면
class WorkerHomeScreen extends StatefulWidget {
  const WorkerHomeScreen({super.key});

  @override
  State<WorkerHomeScreen> createState() => _WorkerHomeScreenState();
}

class _WorkerHomeScreenState extends State<WorkerHomeScreen> {
  String _weatherLocation = '위치 탐색 중...';
  String _weatherTemp = '--°C';
  String _weatherDesc = '날씨 정보를 불러오는 중입니다.';
  IconData _weatherIcon = Icons.cloud;
  bool _isLoadingWeather = true;

  @override
  void initState() {
    super.initState();
    _fetchLocationAndWeather();
  }

  Future<void> _fetchLocationAndWeather() async {
    try {
      // 위치 권한 확인 및 요청
      // Web 테스트 환경 등에서는 에러가 날 수 있으므로 예외 처리 (Zero-Loading)
      bool serviceEnabled;
      LocationPermission permission;

      serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        throw Exception('Location services are disabled.');
      }

      permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          throw Exception('Location permissions are denied');
        }
      }
      
      if (permission == LocationPermission.deniedForever) {
        throw Exception('Location permissions are permanently denied.');
      }

      // 현재 위치 가져오기
      Position position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      
      // 실제 배포 시에는 백엔드(Cloud Run)를 통해 OpenWeather API 호출
      // 현재는 API 키가 없으므로 프론트엔드 목업 데이터로 대체하되, 로직 구조는 완성
      await Future.delayed(const Duration(seconds: 1)); 
      
      if (mounted) {
        setState(() {
          // 위도/경도를 기반으로 가져온 지역명 (Mock)
          _weatherLocation = position.latitude > 37 ? '서울특별시 강남구' : '경기도 수원시';
          _weatherTemp = '22.5°C';
          _weatherDesc = '현재 위치 기반: 맑음, 외부 청소하기 좋습니다!';
          _weatherIcon = Icons.wb_sunny;
          _isLoadingWeather = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _weatherLocation = '위치 정보 없음';
          _weatherTemp = '21.0°C';
          _weatherDesc = '기본 날씨: 구름 많음 (위치 권한 필요)';
          _weatherIcon = Icons.cloud_queue;
          _isLoadingWeather = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        toolbarHeight: 70, // 헤더 높이 대폭 증가 (장갑 터치 고려)
        title: Image.asset(
          'assets/images/logo-ko-h.png',
          height: 36,
          errorBuilder: (context, error, stackTrace) => 
            const Text('크린케어', style: TextStyle(color: Color(0xFF14B8A6), fontWeight: FontWeight.w900, fontSize: 28)),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Color(0xFF1E293B), size: 32), 
        actions: [
          IconButton(
            iconSize: 32, 
            padding: const EdgeInsets.all(16),
            icon: const Icon(Icons.notifications_none, color: Color(0xFF1E293B)),
            onPressed: () {},
          )
        ],
      ),
      // 어쩌다 한 번 쓰는 기능을 위한 사이드바(Drawer) 메뉴 추가
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DrawerHeader(
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [Color(0xFF14B8A6), Color(0xFF2563EB)]),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: const [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor: Colors.white,
                    child: Icon(Icons.person, size: 40, color: Color(0xFF14B8A6)),
                  ),
                  SizedBox(height: 12),
                  Text('김철수 팀장', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                  Text('경기 남부 권역 담당', style: TextStyle(color: Colors.white70, fontSize: 14)),
                ],
              ),
            ),
            ListTile(
              leading: const Icon(Icons.home, size: 28),
              title: const Text('홈 화면', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              onTap: () => Navigator.pop(context),
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.print, color: Color(0xFF2563EB), size: 28),
              title: const Text('현장 모바일 팩스 전송', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF2563EB))),
              subtitle: const Text('관공서 및 교육청 제출용'),
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('관공서 팩스 전송 화면으로 이동합니다.'),
                    backgroundColor: Color(0xFF2563EB),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.history, size: 28),
              title: const Text('과거 작업 이력', style: TextStyle(fontSize: 18)),
              onTap: () => Navigator.pop(context),
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.settings, size: 28),
              title: const Text('앱 설정', style: TextStyle(fontSize: 18)),
              onTap: () => Navigator.pop(context),
            ),
          ],
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 실시간 날씨 위젯 (위치 기반 API 연동 로직 적용)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF14B8A6), Color(0xFF2563EB)], 
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(color: Colors.blue.withOpacity(0.3), blurRadius: 15, offset: const Offset(0, 5))
                ],
              ),
              child: _isLoadingWeather 
                ? const Center(child: CircularProgressIndicator(color: Colors.white))
                : Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('$_weatherLocation', style: const TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Text('현재 날씨: $_weatherTemp', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 12),
                            Text('$_weatherDesc', style: const TextStyle(color: Colors.white, fontSize: 15), softWrap: true,),
                          ],
                        ),
                      ),
                      Icon(_weatherIcon, color: Colors.yellowAccent, size: 64),
                    ],
                  ),
            ),
            const SizedBox(height: 40),
            
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  '배정된 현장 (2건)',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                ),
                TextButton(
                  onPressed: () {}, 
                  child: const Padding(
                    padding: EdgeInsets.all(8.0),
                    child: Text('전체 보기', style: TextStyle(color: Color(0xFF14B8A6), fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            
            _buildJobCard(
              context,
              title: '수원 광교중학교 에어컨 세척',
              time: '10:00 AM - 12:00 PM',
              status: '대기 중',
              isUrgent: false,
            ),
            const SizedBox(height: 24),
            
            _buildJobCard(
              context,
              title: '판교 테크원타워 로비 청소',
              time: '즉시 조치 요망',
              status: 'PC 반려 (재작업)',
              isUrgent: true,
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildJobCard(BuildContext context, {required String title, required String time, required String status, required bool isUrgent}) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: isUrgent ? Colors.red.withOpacity(0.08) : Colors.black.withOpacity(0.04),
            blurRadius: 20,
            offset: const Offset(0, 8),
          )
        ],
        border: Border.all(color: isUrgent ? Colors.red.shade200 : Colors.transparent, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: isUrgent ? Colors.red.shade50 : Colors.teal.shade50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  status,
                  style: TextStyle(
                    color: isUrgent ? Colors.red.shade700 : Colors.teal.shade700,
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
              ),
              Text(time, style: TextStyle(color: isUrgent ? Colors.red.shade400 : Colors.grey.shade600, fontSize: 15, fontWeight: FontWeight.w900)),
            ],
          ),
          const SizedBox(height: 20),
          Text(title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF0F172A), height: 1.3)),
          const SizedBox(height: 28),
          
          // 장갑 낀 상태를 고려하여 버튼 높이를 64px로 대폭 증가
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 64,
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      // 카카오내비 앱링크 (Zero-Loading 예외 처리 방어 로직)
                      const double lat = 37.395;
                      const double lng = 127.111;
                      final Uri kakaoNaviUrl = Uri.parse('kakaonavi://navigate?ep=$lat,$lng&name=${Uri.encodeComponent(title)}');
                      
                      try {
                        if (await canLaunchUrl(kakaoNaviUrl)) {
                          await launchUrl(kakaoNaviUrl);
                        } else {
                          // 앱 미설치 시 플레이스토어/앱스토어로 부드럽게 유도
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('카카오내비 앱이 설치되어 있지 않습니다.\n스토어 설치 화면으로 이동합니다.'),
                              backgroundColor: Colors.orange,
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                          // 실제 상용화 시에는 마켓 URL로 리다이렉트
                          await Future.delayed(const Duration(seconds: 2));
                          final Uri storeUrl = Uri.parse('https://kakaonavi.kakao.com/launch/index.do');
                          launchUrl(storeUrl, mode: LaunchMode.externalApplication);
                        }
                      } catch (e) {
                         ScaffoldMessenger.of(context).showSnackBar(
                           const SnackBar(
                             content: Text('내비게이션 실행 중 오류가 발생했습니다.'),
                             backgroundColor: Colors.red,
                             behavior: SnackBarBehavior.floating,
                           ),
                         );
                      }
                    },
                    icon: const Icon(Icons.navigation, size: 24),
                    label: const Text('카카오내비', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF1E293B),
                      side: const BorderSide(color: Color(0xFFCBD5E1), width: 1.5),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 1,
                child: SizedBox(
                  height: 64,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const ARCameraScreen()),
                      );
                    },
                    icon: const Icon(Icons.view_in_ar, size: 28),
                    label: const Text('AR 촬영', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF14B8A6), 
                      foregroundColor: Colors.white,
                      elevation: 4,
                      shadowColor: const Color(0xFF14B8A6).withOpacity(0.5),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
