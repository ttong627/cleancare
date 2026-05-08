import 'package:flutter/material.dart';
import 'dart:math' as math;

class ARCameraScreen extends StatefulWidget {
  const ARCameraScreen({super.key});

  @override
  State<ARCameraScreen> createState() => _ARCameraScreenState();
}

class _ARCameraScreenState extends State<ARCameraScreen> with SingleTickerProviderStateMixin {
  bool _isScanning = true;
  String _scanResult = '현장 스캔을 준비 중입니다...';
  String _currentTab = '작업 전';
  
  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
    
    _simulateARScan();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  void _simulateARScan() async {
    await Future.delayed(const Duration(seconds: 3));
    if (mounted) {
      setState(() {
        _scanResult = '현장 평면 인식 완료 (오차 0.1%)';
        _isScanning = false;
      });
      _pulseController.stop();
    }
  }

  void _captureAndUpload() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('[$_currentTab] 사진 촬영 완료!\nWebP로 압축되어 초고속 업로드 되었습니다.'),
        backgroundColor: const Color(0xFF14B8A6),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white, size: 32),
        title: const Text('AR 증강현실 뷰어', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, letterSpacing: 1, fontSize: 24)),
        actions: [
          IconButton(
            iconSize: 32,
            icon: const Icon(Icons.flash_on),
            onPressed: () {},
          ),
          const SizedBox(width: 8),
        ],
      ),
      extendBodyBehindAppBar: true,
      body: Stack(
        fit: StackFit.expand,
        children: [
          Container(
            decoration: const BoxDecoration(
              gradient: RadialGradient(
                colors: [Color(0xFF1E293B), Colors.black],
                radius: 1.5,
              ),
            ),
            child: const Center(
              child: Icon(Icons.camera_alt, color: Colors.white12, size: 150),
            ),
          ),
          
          if (_isScanning)
            Center(
              child: AnimatedBuilder(
                animation: _pulseController,
                builder: (context, child) {
                  return Stack(
                    alignment: Alignment.center,
                    children: [
                      Container(
                        width: 250 * _pulseController.value,
                        height: 250 * _pulseController.value,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFF14B8A6).withOpacity(1 - _pulseController.value), width: 6),
                        ),
                      ),
                      Container(
                        width: 120 * _pulseController.value,
                        height: 120 * _pulseController.value,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFF14B8A6).withOpacity((1 - _pulseController.value) * 0.3),
                        ),
                      ),
                      const Icon(Icons.view_in_ar, color: Color(0xFF14B8A6), size: 56),
                    ],
                  );
                },
              ),
            ),
            
          if (_isScanning)
            Positioned(
              top: MediaQuery.of(context).size.height * 0.65,
              left: 0,
              right: 0,
              child: const Center(
                child: Text('주변 환경을 스캔하는 중입니다...', style: TextStyle(color: Colors.white70, fontSize: 18, letterSpacing: 2, fontWeight: FontWeight.bold)),
              ),
            ),
            
          // 누락 기능 추가: 우측 상단 2D 미니맵
          if (!_isScanning)
            Positioned(
              top: 100,
              right: 20,
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF14B8A6).withOpacity(0.5), width: 2),
                ),
                child: Stack(
                  children: [
                    Center(child: Icon(Icons.map, color: Colors.white.withOpacity(0.3), size: 60)),
                    Positioned(
                      top: 8, left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: const Color(0xFF14B8A6), borderRadius: BorderRadius.circular(4)),
                        child: const Text('2D 맵', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                      ),
                    ),
                    Positioned(
                      bottom: 40, right: 40,
                      child: Container(width: 8, height: 8, decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle)),
                    )
                  ],
                ),
              ),
            ),
            
          Positioned(
            bottom: 30,
            left: 20,
            right: 20,
            child: Column(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 500),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                  decoration: BoxDecoration(
                    color: _isScanning ? Colors.black54 : const Color(0xFF14B8A6).withOpacity(0.9),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: _isScanning ? [] : [
                      BoxShadow(color: const Color(0xFF14B8A6).withOpacity(0.5), blurRadius: 20, spreadRadius: 2)
                    ]
                  ),
                  child: Text(
                    _scanResult,
                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(height: 24),
                
                // 누락 기능 추가: 하단 단계별(전/중/후) 탭
                if (!_isScanning)
                  Container(
                    margin: const EdgeInsets.only(bottom: 24),
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.black87,
                      borderRadius: BorderRadius.circular(30),
                      border: Border.all(color: Colors.white24),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: ['작업 전', '작업 중', '작업 후'].map((tab) {
                        final isSelected = _currentTab == tab;
                        return GestureDetector(
                          onTap: () => setState(() => _currentTab = tab),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                            decoration: BoxDecoration(
                              color: isSelected ? const Color(0xFF2563EB) : Colors.transparent,
                              borderRadius: BorderRadius.circular(24),
                            ),
                            child: Text(
                              tab,
                              style: TextStyle(
                                color: isSelected ? Colors.white : Colors.white54,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                fontSize: 16,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                  
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    FloatingActionButton(
                      heroTag: 'cancel',
                      backgroundColor: Colors.white12,
                      elevation: 0,
                      onPressed: () => Navigator.pop(context),
                      child: const Icon(Icons.close, color: Colors.white, size: 32), // 장갑 터치 크기업
                    ),
                    
                    // 장갑용 초거대 셔터 버튼 (100x100)
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 300),
                      height: 100,
                      width: 100,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _isScanning ? Colors.grey.shade800 : Colors.white,
                        boxShadow: _isScanning ? [] : [
                          BoxShadow(color: Colors.white.withOpacity(0.3), blurRadius: 20, spreadRadius: 5)
                        ],
                        border: Border.all(color: _isScanning ? Colors.transparent : const Color(0xFF14B8A6), width: 4),
                      ),
                      child: IconButton(
                        iconSize: 48,
                        icon: Icon(Icons.camera, color: _isScanning ? Colors.grey : const Color(0xFF0F172A)),
                        onPressed: _isScanning ? null : _captureAndUpload,
                      ),
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
