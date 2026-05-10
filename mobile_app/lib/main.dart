import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:geocoding/geocoding.dart';
import 'screens/login_screen.dart';
import 'screens/ar_camera_screen.dart';
import 'screens/fax_document_screen.dart';
import 'screens/navigation_screen.dart';
import 'firebase_options.dart';
import 'services/offline_sync_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  } catch (e) {
    debugPrint('Firebase init failed: $e');
  }
  await OfflineSyncService.initializeDB();
  runApp(const CleanCareApp());
}

class CleanCareApp extends StatelessWidget {
  const CleanCareApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '크린케어시스템',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF005BB7),
          primary: const Color(0xFF00448C),
          secondary: const Color(0xFF7DD3FC),
          surface: Colors.white,
          onSurface: const Color(0xFF0B1C30),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        fontFamily: 'Roboto',
      ),
      // Firebase Auth 상태에 따라 로그인 / 홈 화면 자동 전환
      home: StreamBuilder<User?>(
        stream: FirebaseAuth.instance.authStateChanges(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          if (snapshot.hasData && snapshot.data != null) {
            return const WorkerHomeScreen();
          }
          return const LoginScreen();
        },
      ),
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
  final Set<String> _photosCompletedJobs = {};
  String _appVersion = '';

  @override
  void initState() {
    super.initState();
    _fetchLocationAndWeather();
    _loadVersion();
  }

  Future<void> _loadVersion() async {
    try {
      final info = await PackageInfo.fromPlatform();
      if (mounted) setState(() => _appVersion = 'v${info.version}');
    } catch (_) {
      if (mounted) setState(() => _appVersion = 'v1.1.0');
    }
  }

  Future<void> _fetchLocationAndWeather() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) throw Exception('denied');
      }
      if (permission == LocationPermission.deniedForever) throw Exception('forever');

      Position? position = await Geolocator.getLastKnownPosition();
      position ??= await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.low,
      ).timeout(const Duration(seconds: 15));

      const apiKey = '6bd6f9a2db4d2d9ca79a98af437be950';
      final url = 'https://api.openweathermap.org/data/2.5/weather'
          '?lat=${position.latitude}&lon=${position.longitude}&units=metric&lang=kr&appid=$apiKey';
      final res = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 8));

      // 한국어 지역명: 기기 네이티브 역지오코딩
      String locationName = '';
      try {
        final marks = await placemarkFromCoordinates(position!.latitude, position.longitude);
        if (marks.isNotEmpty) {
          final m = marks.first;
          locationName = [m.subLocality, m.locality]
              .where((s) => s != null && s!.isNotEmpty)
              .map((s) => s!)
              .join(' ');
        }
      } catch (_) {}

      if (res.statusCode == 200) {
        final j = jsonDecode(res.body);
        final temp  = (j['main']['temp'] as num).round();
        final desc  = j['weather'][0]['description'] as String;
        final id    = j['weather'][0]['id'] as int;
        final city  = locationName.isNotEmpty ? locationName : j['name'] as String;
        final icon  = id < 300 ? Icons.thunderstorm
            : id < 600 ? Icons.grain
            : id < 700 ? Icons.ac_unit
            : id < 800 ? Icons.cloud
            : id == 800 ? Icons.wb_sunny
            : Icons.cloud_queue;
        final advice = id == 800 || id == 801 ? '외부 청소하기 좋습니다!' : '날씨를 확인하고 작업하세요.';
        if (mounted) setState(() {
          _weatherLocation = city;
          _weatherTemp = '$temp°C';
          _weatherDesc = '현재 위치 기반: $desc, $advice';
          _weatherIcon = icon;
          _isLoadingWeather = false;
        });
      } else {
        throw Exception('API error ${res.statusCode}');
      }
    } catch (e) {
      if (mounted) setState(() {
        _weatherLocation = '위치 정보 없음';
        _weatherTemp = '--°C';
        _weatherDesc = '날씨 정보를 불러올 수 없습니다 (위치 권한 확인)';
        _weatherIcon = Icons.cloud_queue;
        _isLoadingWeather = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        toolbarHeight: 70,
        title: Row(
          children: [
            Image.asset(
              'assets/images/logo1.png',
              height: 44,
              fit: BoxFit.contain,
              errorBuilder: (context, error, stackTrace) =>
                const Text('크린케어시스템', style: TextStyle(color: Color(0xFF005BB7), fontWeight: FontWeight.w900, fontSize: 24)),
            ),
            if (_appVersion.isNotEmpty) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF005BB7).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFF005BB7).withValues(alpha: 0.3)),
                ),
                child: Text(_appVersion,
                  style: const TextStyle(color: Color(0xFF005BB7), fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ],
          ],
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        iconTheme: const IconThemeData(color: Color(0xFF0B1C30), size: 32),
        actions: [
          IconButton(
            iconSize: 32,
            padding: const EdgeInsets.all(16),
            icon: const Icon(Icons.notifications_none, color: Color(0xFF0B1C30)),
            onPressed: () {},
          )
        ],
      ),
      drawer: Drawer(
        backgroundColor: const Color(0xFFF8F9FF),
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DrawerHeader(
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [Color(0xFF005BB7), Color(0xFF00448C)]),
              ),
              child: Builder(builder: (context) {
                final user = FirebaseAuth.instance.currentUser;
                final name = user?.displayName ?? user?.email ?? '작업자';
                final sub  = user?.email ?? user?.phoneNumber ?? '';
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    const CircleAvatar(
                      radius: 30,
                      backgroundColor: Colors.white,
                      child: Icon(Icons.person, size: 40, color: Color(0xFF005BB7)),
                    ),
                    const SizedBox(height: 12),
                    Text(name, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                    if (sub.isNotEmpty)
                      Text(sub, style: const TextStyle(color: Colors.white70, fontSize: 13)),
                  ],
                );
              }),
            ),
            ListTile(
              leading: const Icon(Icons.home, size: 28, color: Color(0xFF0B1C30)),
              title: const Text('홈 화면', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0B1C30))),
              onTap: () => Navigator.pop(context),
            ),
            const Divider(color: Color(0xFFC2C6D4)),
            ListTile(
              leading: const Icon(Icons.print, color: Color(0xFF005BB7), size: 28),
              title: const Text('현장 모바일 팩스 전송', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF005BB7))),
              subtitle: const Text('관공서 및 교육청 제출용', style: TextStyle(color: Color(0xFF424752))),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (context) => const FaxDocumentScreen()));
              },
            ),
            ListTile(
              leading: const Icon(Icons.history, size: 28, color: Color(0xFF0B1C30)),
              title: const Text('과거 작업 이력', style: TextStyle(fontSize: 18, color: Color(0xFF0B1C30))),
              onTap: () => Navigator.pop(context),
            ),
            const Divider(color: Color(0xFFC2C6D4)),
            ListTile(
              leading: const Icon(Icons.settings, size: 28, color: Color(0xFF0B1C30)),
              title: const Text('앱 설정', style: TextStyle(fontSize: 18, color: Color(0xFF0B1C30))),
              onTap: () => Navigator.pop(context),
            ),
            const Divider(color: Color(0xFFC2C6D4)),
            ListTile(
              leading: const Icon(Icons.logout, size: 28, color: Color(0xFFBA1A1A)),
              title: const Text('로그아웃', style: TextStyle(fontSize: 18, color: Color(0xFFBA1A1A), fontWeight: FontWeight.bold)),
              onTap: () async {
                Navigator.pop(context);
                await FirebaseAuth.instance.signOut();
              },
            ),
            const Divider(color: Color(0xFFC2C6D4)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(children: [
                const Icon(Icons.info_outline, size: 16, color: Color(0xFF9AA5B4)),
                const SizedBox(width: 8),
                Text('크린케어시스템 $_appVersion',
                  style: const TextStyle(color: Color(0xFF9AA5B4), fontSize: 13)),
              ]),
            ),
          ],
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 실시간 날씨 위젯
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF005BB7), Color(0xFF00448C)],
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(color: const Color(0xFF00448C).withOpacity(0.15), blurRadius: 20, offset: const Offset(0, 8))
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
                            Text('$_weatherLocation', style: const TextStyle(color: Color(0xFFC4D7FF), fontSize: 14, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Text('현재 날씨: $_weatherTemp', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 12),
                            Text('$_weatherDesc', style: const TextStyle(color: Colors.white, fontSize: 15), softWrap: true,),
                          ],
                        ),
                      ),
                      Icon(_weatherIcon, color: const Color(0xFF7DD3FC), size: 64),
                    ],
                  ),
            ),
            const SizedBox(height: 40),

            _buildFirestoreJobList(),

            const SizedBox(height: 24),
            if (_appVersion.isNotEmpty)
              Center(
                child: Text(_appVersion,
                  style: const TextStyle(color: Color(0xFFB0B8C4), fontSize: 12)),
              ),
            const SizedBox(height: 40),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _createNewJob,
        backgroundColor: const Color(0xFF005BB7),
        icon: const Icon(Icons.add_location_alt, color: Colors.white),
        label: const Text('임의 현장 생성', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildFirestoreJobList() {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('projects')
          .orderBy('createdAt', descending: true)
          .limit(20)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return _buildErrorSection('데이터를 불러오지 못했습니다: ${snapshot.error}');
        }

        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: Padding(
            padding: EdgeInsets.all(40),
            child: CircularProgressIndicator(),
          ));
        }

        final docs = snapshot.data?.docs ?? [];
        final pendingDocs = docs.where((d) {
          final data = d.data() as Map<String, dynamic>;
          final status = data['status'] ?? '';
          return status != 'COMPLETED';
        }).toList();

        return _buildJobListContent(pendingDocs);
      },
    );
  }

Widget _buildErrorSection(String message) {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Center(
        child: Column(
          children: [
            const Icon(Icons.error_outline, size: 48, color: Color(0xFFBA1A1A)),
            const SizedBox(height: 12),
            Text(message, style: const TextStyle(color: Colors.grey, fontSize: 14), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  Widget _buildJobListContent(List<QueryDocumentSnapshot> pendingDocs) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '배정된 현장 (${pendingDocs.length}건)',
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF0B1C30)),
            ),
            TextButton(
              onPressed: () {},
              child: const Padding(
                padding: EdgeInsets.all(8.0),
                child: Text('전체 보기', style: TextStyle(color: Color(0xFF005BB7), fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        if (pendingDocs.isEmpty)
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Center(
              child: Column(
                children: [
                  Icon(Icons.check_circle, size: 48, color: Color(0xFF14B8A6)),
                  SizedBox(height: 12),
                  Text('현재 배정된 작업이 없습니다.', style: TextStyle(color: Colors.grey, fontSize: 16)),
                ],
              ),
            ),
          )
        else
          ...pendingDocs.map((doc) {
            final data = doc.data() as Map<String, dynamic>;
            final name = data['name'] ?? '현장명 없음';
            final status = data['status'] ?? 'PENDING';
            final isUrgent = status == 'REJECTED';
            final address = data['address'] ?? '';
            final photoMode = data['photoMode'] as String? ?? 'bda';
            final statusLabel = status == 'REJECTED' ? 'PC 반려 (재작업)'
                : status == 'IN_PROGRESS' ? '작업 진행 중'
                : '대기 중';

            return Padding(
              padding: const EdgeInsets.only(bottom: 24),
              child: _buildJobCard(
                context,
                docId: doc.id,
                title: name,
                address: address.isNotEmpty ? address : '주소 미등록',
                status: statusLabel,
                isUrgent: isUrgent,
                photosCompleted: _photosCompletedJobs.contains(doc.id),
                photoMode: photoMode,
              ),
            );
          }),
      ],
    );
  }

  /// 작업자가 현장에서 임의로 새로운 작업을 생성하는 기능
  Future<void> _createNewJob() async {
    final nameController = TextEditingController();
    final addressController = TextEditingController();
    String photoMode = 'bda'; // default: 전/중/후

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('새 현장 만들기', style: TextStyle(fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('배정된 작업이 없더라도 새 현장을 등록하여 바로 작업을 시작할 수 있습니다.', style: TextStyle(fontSize: 13, color: Colors.grey)),
              const SizedBox(height: 16),
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: '현장 이름 (예: 강남 빌딩)', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: addressController,
                decoration: const InputDecoration(labelText: '주소 또는 상세 위치', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 16),
              const Align(alignment: Alignment.centerLeft,
                child: Text('사진 구성', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0B1C30)))),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(child: GestureDetector(
                  onTap: () => setDialogState(() => photoMode = 'ba'),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      color: photoMode == 'ba' ? const Color(0xFF005BB7) : const Color(0xFFF5F5F5),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: photoMode == 'ba' ? const Color(0xFF005BB7) : Colors.grey.shade300),
                    ),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.looks_two, color: photoMode == 'ba' ? Colors.white : Colors.grey, size: 22),
                      const SizedBox(height: 4),
                      Text('전 · 후\n2단계', textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold,
                          color: photoMode == 'ba' ? Colors.white : Colors.grey.shade600)),
                    ]),
                  ),
                )),
                const SizedBox(width: 10),
                Expanded(child: GestureDetector(
                  onTap: () => setDialogState(() => photoMode = 'bda'),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      color: photoMode == 'bda' ? const Color(0xFF005BB7) : const Color(0xFFF5F5F5),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: photoMode == 'bda' ? const Color(0xFF005BB7) : Colors.grey.shade300),
                    ),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.looks_3, color: photoMode == 'bda' ? Colors.white : Colors.grey, size: 22),
                      const SizedBox(height: 4),
                      Text('전 · 중 · 후\n3단계', textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold,
                          color: photoMode == 'bda' ? Colors.white : Colors.grey.shade600)),
                    ]),
                  ),
                )),
              ]),
              const SizedBox(height: 6),
              Text(
                photoMode == 'ba' ? '작업 전·후 사진만 촬영합니다.' : '작업 전·중·후 사진을 촬영합니다.',
                style: const TextStyle(fontSize: 11, color: Colors.grey),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF005BB7)),
              child: const Text('생성 및 시작', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true && nameController.text.isNotEmpty) {
      try {
        await FirebaseFirestore.instance.collection('projects').add({
          'name': nameController.text,
          'address': addressController.text,
          'status': 'PENDING',
          'photoMode': photoMode,
          'createdAt': DateTime.now().millisecondsSinceEpoch,
          'updatedAt': DateTime.now().millisecondsSinceEpoch,
          'createdBy': 'MOBILE_WORKER',
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('새 현장이 성공적으로 등록되었습니다.'),
              backgroundColor: Color(0xFF14B8A6),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('생성 실패: $e'), backgroundColor: const Color(0xFFBA1A1A)),
          );
        }
      }
    }
  }

  Future<void> _deleteProject(String docId, String title) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('작업장 삭제', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFBA1A1A))),
        content: Text('「$title」 작업장을 삭제하시겠습니까?\n\n사진, AR 스팟, 정산 정보가 모두 영구 삭제됩니다.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFBA1A1A)),
            child: const Text('삭제', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await FirebaseFirestore.instance.collection('projects').doc(docId).delete();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('「$title」이(가) 삭제되었습니다.'),
              backgroundColor: const Color(0xFFBA1A1A),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('삭제 실패: $e'), backgroundColor: const Color(0xFFBA1A1A)),
          );
        }
      }
    }
  }

  Future<void> _completeJob(String docId, String title) async {

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('작업 완료 처리', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Text('[$title] 현장의 모든 작업이 완료되었습니까?\n\n완료 처리 후 PC 관리자 대시보드에 즉시 반영됩니다.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF14B8A6)),
            child: const Text('작업 완료', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await FirebaseFirestore.instance.collection('projects').doc(docId).update({
          'status': 'COMPLETED',
          'updatedAt': DateTime.now().millisecondsSinceEpoch,
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('[$title] 작업이 완료 처리되었습니다!'),
              backgroundColor: const Color(0xFF14B8A6),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('완료 처리 실패: $e'),
              backgroundColor: const Color(0xFFBA1A1A),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    }
  }

  Widget _buildJobCard(BuildContext context, {
    required String docId,
    required String title,
    required String address,
    required String status,
    required bool isUrgent,
    required bool photosCompleted,
    String photoMode = 'bda',
  }) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: isUrgent ? const Color(0xFFBA1A1A).withOpacity(0.08) : const Color(0xFF00448C).withOpacity(0.05),
            blurRadius: 20,
            offset: const Offset(0, 8),
          )
        ],
        border: Border.all(color: isUrgent ? const Color(0xFFFFDAD6) : Colors.transparent, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 상태 배지
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(
                  color: isUrgent ? const Color(0xFFFFDAD6) : const Color(0xFFE5EEFF),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  status,
                  style: TextStyle(
                    color: isUrgent ? const Color(0xFF93000A) : const Color(0xFF00448C),
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
              ),
              if (photosCompleted) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(8)),
                  child: const Row(children: [
                    Icon(Icons.photo_camera, size: 14, color: Color(0xFF16A34A)),
                    SizedBox(width: 4),
                    Text('촬영 완료', style: TextStyle(color: Color(0xFF16A34A), fontWeight: FontWeight.bold, fontSize: 13)),
                  ]),
                ),
              ],
              const Spacer(),
              IconButton(
                onPressed: () => _deleteProject(docId, title),
                icon: const Icon(Icons.delete_outline, color: Color(0xFFBA1A1A), size: 22),
                tooltip: '작업장 삭제',
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),

          const SizedBox(height: 16),
          Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF0B1C30), height: 1.3)),

          // 주소
          if (address.isNotEmpty && address != '주소 미등록') ...[
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.location_on, size: 15, color: Color(0xFF94A3B8)),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(address, style: const TextStyle(color: Color(0xFF64748B), fontSize: 13), overflow: TextOverflow.ellipsis),
                ),
              ],
            ),
          ],

          const SizedBox(height: 22),

          // ── 내비게이션 버튼 (단독 전체 폭) ──────────────────────
          SizedBox(
            width: double.infinity,
            height: 56,
            child: OutlinedButton.icon(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => NavigationScreen(jobName: title, address: address)),
              ),
              icon: const Icon(Icons.navigation_rounded, size: 24, color: Color(0xFF005BB7)),
              label: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('내비게이션 안내', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF005BB7))),
                  Text(address == '주소 미등록' ? '주소 미등록' : '주소 자동 복사 → 앱 선택',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                ],
              ),
              style: OutlinedButton.styleFrom(
                alignment: Alignment.centerLeft,
                padding: const EdgeInsets.symmetric(horizontal: 18),
                side: const BorderSide(color: Color(0xFF005BB7), width: 1.8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),

          const SizedBox(height: 12),

          // ── AR 촬영 + 완료 버튼 ───────────────────────────────
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 56,
                  child: ElevatedButton.icon(
                    onPressed: () async {
                      final completed = await Navigator.push<bool>(context, MaterialPageRoute(
                        builder: (_) => ARCameraScreen(jobId: docId, jobName: title, photoMode: photoMode),
                      ));
                      if (completed == true && mounted) {
                        setState(() => _photosCompletedJobs.add(docId));
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                          content: Text('촬영이 완료되었습니다. 완료 버튼을 눌러 마무리하세요.'),
                          backgroundColor: Color(0xFF14B8A6),
                          behavior: SnackBarBehavior.floating,
                        ));
                      }
                    },
                    icon: const Icon(Icons.view_in_ar, size: 22),
                    label: const Text('AR 촬영', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF00448C),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ),

              // 완료 버튼: 후 사진 촬영 완료 후에만 표시
              if (photosCompleted) ...[
                const SizedBox(width: 10),
                Expanded(
                  child: SizedBox(
                    height: 56,
                    child: ElevatedButton.icon(
                      onPressed: () => _completeJob(docId, title),
                      icon: const Icon(Icons.check_circle, size: 22),
                      label: const Text('작업 완료', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF14B8A6),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),

          // 촬영 전 안내 메시지
          if (!photosCompleted) ...[
            const SizedBox(height: 10),
            const Row(
              children: [
                Icon(Icons.info_outline, size: 14, color: Color(0xFF94A3B8)),
                SizedBox(width: 6),
                Text('AR 촬영 완료 후 작업 완료 버튼이 활성화됩니다', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
