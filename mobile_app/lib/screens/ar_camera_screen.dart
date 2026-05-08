import 'package:flutter/material.dart';

class ARCameraScreen extends StatefulWidget {
  const ARCameraScreen({super.key});

  @override
  State<ARCameraScreen> createState() => _ARCameraScreenState();
}

class _ARCameraScreenState extends State<ARCameraScreen> {
  bool _isScanning = true;
  String _scanResult = '현장 스캔을 준비 중입니다...';

  @override
  void initState() {
    super.initState();
    _simulateARScan();
  }

  void _simulateARScan() async {
    // 실제 ARCore/ARKit 연동 시 이 부분에서 평면 인식 및 포인트 클라우드 처리
    await Future.delayed(const Duration(seconds: 2));
    if (mounted) {
      setState(() {
        _scanResult = '현장 오염도 인식 완료 (수치: 87%)';
        _isScanning = false;
      });
    }
  }

  void _captureAndUpload() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('AR 결과가 암호화되어 클라우드로 업로드 되었습니다.')),
    );
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Text('AR 증강현실 검수', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      extendBodyBehindAppBar: true,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // 웹 등에서 카메라 플러그인 에러를 막기 위한 Mock UI (Zero-Loading)
          Container(
            color: const Color(0xFF1E293B),
            child: const Center(
              child: Icon(Icons.camera_alt, color: Colors.white38, size: 100),
            ),
          ),
          
          if (_isScanning)
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  CircularProgressIndicator(color: Color(0xFF14B8A6)),
                  SizedBox(height: 16),
                  Text('주변 환경을 스캔하는 중입니다...', style: TextStyle(color: Colors.white)),
                ],
              ),
            ),
            
          Positioned(
            bottom: 40,
            left: 20,
            right: 20,
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    _scanResult,
                    style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    FloatingActionButton(
                      heroTag: 'cancel',
                      backgroundColor: Colors.white24,
                      onPressed: () => Navigator.pop(context),
                      child: const Icon(Icons.close, color: Colors.white),
                    ),
                    FloatingActionButton.large(
                      heroTag: 'capture',
                      backgroundColor: const Color(0xFF14B8A6),
                      onPressed: _isScanning ? null : _captureAndUpload,
                      child: const Icon(Icons.camera, color: Colors.white, size: 40),
                    ),
                  ],
                ),
              ],
            ),
          )
        ],
      ),
    );
  }
}
