import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'screens/ar_camera_screen.dart';

void main() {
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
          seedColor: const Color(0xFF1E3A8A), // 프리미엄 블루 테마
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        fontFamily: 'Roboto',
      ),
      // 초기 라우트를 로그인 화면으로 변경
      home: const LoginScreen(),
    );
  }
}

// 작업자 홈 화면 (기존 코드 유지 및 일부 버튼 네비게이션 추가)
class WorkerHomeScreen extends StatelessWidget {
  const WorkerHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('오늘의 작업 내역', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none, color: Color(0xFF1E293B)),
            onPressed: () {},
          )
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 실시간 날씨 및 추천 위젯
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF3B82F6), Color(0xFF1D4ED8)], 
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(color: Colors.blue.withOpacity(0.3), blurRadius: 15, offset: const Offset(0, 5))
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text('현재 날씨: 맑음 (21.5°C)', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                      SizedBox(height: 8),
                      Text('외부 유리창 청소하기 좋은 날씨입니다!', style: TextStyle(color: Colors.white70, fontSize: 14)),
                    ],
                  ),
                  const Icon(Icons.wb_sunny, color: Colors.yellowAccent, size: 48),
                ],
              ),
            ),
            const SizedBox(height: 32),
            
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  '배정된 현장 (2건)',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                ),
                TextButton(onPressed: () {}, child: const Text('전체 보기')),
              ],
            ),
            const SizedBox(height: 12),
            
            _buildJobCard(
              context,
              title: '수원 광교중학교 에어컨 세척',
              time: '10:00 AM - 12:00 PM',
              status: '대기 중',
              isUrgent: false,
            ),
            const SizedBox(height: 16),
            
            _buildJobCard(
              context,
              title: '판교 테크원타워 로비 청소',
              time: '즉시 조치 요망',
              status: 'PC 반려 (재작업)',
              isUrgent: true,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildJobCard(BuildContext context, {required String title, required String time, required String status, required bool isUrgent}) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: isUrgent ? Colors.red.withOpacity(0.08) : Colors.black.withOpacity(0.03),
            blurRadius: 15,
            offset: const Offset(0, 5),
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
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: isUrgent ? Colors.red.shade50 : Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  status,
                  style: TextStyle(
                    color: isUrgent ? Colors.red.shade700 : Colors.blue.shade700,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
              ),
              Text(time, style: TextStyle(color: isUrgent ? Colors.red.shade400 : Colors.grey, fontSize: 13, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 16),
          Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.navigation, size: 18),
                  label: const Text('카카오 길안내', style: TextStyle(fontWeight: FontWeight.bold)),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    foregroundColor: const Color(0xFF1E293B),
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (context) => const ARCameraScreen()),
                    );
                  },
                  icon: const Icon(Icons.view_in_ar, size: 18),
                  label: const Text('AR 촬영 진입', style: TextStyle(fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          )
        ],
      ),
    );
  }
}
