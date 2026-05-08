import 'package:flutter/material.dart';

class ARCameraScreen extends StatelessWidget {
  const ARCameraScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // AR 카메라 프리뷰 목업 영역
          Positioned.fill(
            child: Container(
              decoration: const BoxDecoration(
                image: DecorationImage(
                  image: NetworkImage('https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=600'),
                  fit: BoxFit.cover,
                ),
              ),
            ),
          ),
          
          // 오버레이 UI (AR 가이드라인)
          Center(
            child: Container(
              width: 300,
              height: 400,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.greenAccent.withOpacity(0.8), width: 2),
              ),
              child: const Center(
                child: Text(
                  '+',
                  style: TextStyle(color: Colors.greenAccent, fontSize: 48, fontWeight: FontWeight.w100),
                ),
              ),
            ),
          ),

          // 상단 네비게이션 및 미니맵
          Positioned(
            top: 50,
            left: 20,
            right: 20,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
                  onPressed: () => Navigator.pop(context),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text('구도 일치율: 98%', style: TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold)),
                ),
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: Colors.black87,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.white24),
                  ),
                  child: const Center(child: Text('미니맵', style: TextStyle(color: Colors.white54, fontSize: 12))),
                )
              ],
            ),
          ),

          // 하단 셔터 및 컨트롤
          Positioned(
            bottom: 40,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    Icon(Icons.layers_clear, color: Colors.white, size: 30),
                    SizedBox(height: 8),
                    Text('잔상 끄기', style: TextStyle(color: Colors.white, fontSize: 12)),
                  ],
                ),
                GestureDetector(
                  onTap: () {
                    // 사진 촬영 및 로컬 DB 저장 로직 (오프라인 퍼스트)
                  },
                  child: Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 4),
                      color: Colors.white30,
                    ),
                    child: Center(
                      child: Container(
                        width: 60,
                        height: 60,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    Icon(Icons.flash_off, color: Colors.white, size: 30),
                    SizedBox(height: 8),
                    Text('플래시', style: TextStyle(color: Colors.white, fontSize: 12)),
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
