import 'dart:typed_data';
import 'package:flutter/foundation.dart';
// import 'package:image/image.dart' as img; // 이미지 픽셀 편집 라이브러리
// import 'package:geolocator/geolocator.dart';

/// 현장 작업자 전용 앱 (플랜 B) - GPS 워터마크 엔진
/// 사진의 메타데이터(EXIF) 조작을 방지하기 위해, 
/// 렌즈에 포착된 이미지 자체에 "위도/경도/시간/장소명"을 직접 그려버리는(Stamp) 기능
class WatermarkService {

  /// 원본 이미지 바이트를 받아서, 하단에 검은색 반투명 띠를 두르고
  /// 흰색 글씨로 GPS 좌표와 시간을 강제 합성하여 반환합니다.
  static Future<Uint8List> applyGPSWatermark(Uint8List originalImage) async {
    // 실제 프로덕션:
    // 1. 현재 위도, 경도 획득
    // Position position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.best);
    // 2. img.decodeImage(originalImage) 로 원본 로드
    // 3. img.drawString() 함수로 픽셀 데이터에 문자열 삽입
    // 4. return img.encodeJpg(watermarkedImg);
    
    await Future.delayed(const Duration(milliseconds: 600));
    
    debugPrint('[Watermark] 📷 사진 하단에 [37.395, 127.111 | 2026-05-09 13:28 | 수원 광교중학교] 정보 강제 합성 완료');
    
    // 모의 구현에서는 원본을 그대로 반환
    return originalImage; 
  }
}
