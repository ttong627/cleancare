import 'package:isar/isar.dart';

part 'offline_photo.g.dart'; // Isar Generator가 생성할 파일

/// 통신 단절 시 스마트폰 내부(SQLite/Isar)에 저장될 사진 데이터 모델
@collection
class OfflinePhoto {
  Id id = Isar.autoIncrement; // 자동 증가 ID

  /// 해당 사진이 속한 작업 현장의 고유 ID
  late String jobId;

  /// 작업 전, 중, 후 구분
  late String workStep;

  /// AR 3D 핀(마커)의 고유 식별자 또는 좌표
  late String arNodeId;

  /// GPS 위도
  late double latitude;

  /// GPS 경도
  late double longitude;

  /// 디바이스 내부에 임시 저장된 사진 파일의 절대 경로
  late String localFilePath;

  /// 촬영 일시
  late DateTime capturedAt;

  /// 서버 업로드 완료 여부 (Background Sync시 판별 기준)
  bool isUploaded = false;
}
