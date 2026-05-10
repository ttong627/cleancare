import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:path_provider/path_provider.dart';

/// 사진 폴더 구조 및 Firebase Storage 업로드/삭제 담당
///
/// Storage 경로:
///   photos/
///     2026-05/              ← 월 단위 폴더 (3개월 경과 시 자동 삭제)
///       2026-05-10/         ← 일 단위 폴더
///         JOB_강남빌딩/      ← 작업 단위 폴더
///           작업전_143025.jpg
///           작업중_150012.jpg
///           작업후_153548.jpg
class PhotoStorageService {
  static final _storage = FirebaseStorage.instance;

  // ──────────────────────────────────────────────
  // 경로 생성
  // ──────────────────────────────────────────────

  /// Storage 경로 반환
  /// e.g. photos/2026-05/2026-05-10/JOB_강남빌딩/작업전_143025.jpg
  static String buildStoragePath({
    required String jobId,
    required String jobName,
    required String workStep,
    required DateTime capturedAt,
  }) {
    final monthFolder = _monthKey(capturedAt);          // 2026-05
    final dayFolder   = _dayKey(capturedAt);            // 2026-05-10
    final jobFolder   = _sanitize('${jobId}_$jobName'); // JOB_1234_강남빌딩
    final fileName    = '${workStep}_${_timeKey(capturedAt)}.jpg';
    return 'photos/$monthFolder/$dayFolder/$jobFolder/$fileName';
  }

  /// 로컬 임시 저장 경로 반환 (오프라인 보관용)
  static Future<String> buildLocalPath({
    required String jobId,
    required String jobName,
    required String workStep,
    required DateTime capturedAt,
  }) async {
    final baseDir = await getApplicationDocumentsDirectory();
    final monthFolder = _monthKey(capturedAt);
    final dayFolder   = _dayKey(capturedAt);
    final jobFolder   = _sanitize('${jobId}_$jobName');
    final dir = Directory('${baseDir.path}/photos/$monthFolder/$dayFolder/$jobFolder');
    if (!await dir.exists()) await dir.create(recursive: true);
    final fileName = '${workStep}_${_timeKey(capturedAt)}.jpg';
    return '${dir.path}/$fileName';
  }

  // ──────────────────────────────────────────────
  // 업로드
  // ──────────────────────────────────────────────

  /// Firebase Storage에 사진 업로드 후 다운로드 URL 반환
  static Future<String> uploadPhoto({
    required String jobId,
    required String jobName,
    required String workStep,
    required Uint8List imageBytes,
    required DateTime capturedAt,
  }) async {
    final storagePath = buildStoragePath(
      jobId: jobId,
      jobName: jobName,
      workStep: workStep,
      capturedAt: capturedAt,
    );

    final ref = _storage.ref(storagePath);
    await ref.putData(
      imageBytes,
      SettableMetadata(
        contentType: 'image/jpeg',
        customMetadata: {
          'jobId'    : jobId,
          'jobName'  : jobName,
          'workStep' : workStep,
          'capturedAt': capturedAt.toIso8601String(),
        },
      ),
    );

    final url = await ref.getDownloadURL();
    debugPrint('[PhotoStorage] ✅ 업로드 완료: $storagePath');
    return url;
  }

  /// 로컬에 사진 임시 저장 (오프라인 시 사용)
  static Future<String> savePhotoLocally({
    required String jobId,
    required String jobName,
    required String workStep,
    required Uint8List imageBytes,
    required DateTime capturedAt,
  }) async {
    final localPath = await buildLocalPath(
      jobId: jobId,
      jobName: jobName,
      workStep: workStep,
      capturedAt: capturedAt,
    );
    await File(localPath).writeAsBytes(imageBytes);
    debugPrint('[PhotoStorage] 💾 로컬 저장: $localPath');
    return localPath;
  }

  // ──────────────────────────────────────────────
  // 3개월 이상 된 폴더 자동 삭제
  // ──────────────────────────────────────────────

  /// 앱 시작 시 호출 — Storage + 로컬 모두 정리
  static Future<void> cleanupOldPhotos() async {
    await Future.wait([
      _cleanupStorage(),
      _cleanupLocal(),
    ]);
  }

  /// Firebase Storage: photos/ 하위 월 폴더를 순회하며 3개월 초과 삭제
  static Future<void> _cleanupStorage() async {
    try {
      final photosRef = _storage.ref('photos');
      final monthFolders = await photosRef.listAll();

      final cutoff = _cutoffMonth();

      for (final monthRef in monthFolders.prefixes) {
        final folderName = monthRef.name; // e.g. "2026-02"
        if (_isOlderThanCutoff(folderName, cutoff)) {
          debugPrint('[PhotoStorage] 🗑 Storage 삭제 대상: $folderName');
          await _deleteStorageFolderRecursive(monthRef);
          debugPrint('[PhotoStorage] ✅ Storage 삭제 완료: $folderName');
        }
      }
    } catch (e) {
      debugPrint('[PhotoStorage] ⚠️ Storage 정리 실패 (무시): $e');
    }
  }

  /// Firebase Storage 폴더 재귀 삭제
  static Future<void> _deleteStorageFolderRecursive(Reference ref) async {
    final list = await ref.listAll();
    await Future.wait([
      ...list.items.map((item) => item.delete()),
      ...list.prefixes.map((sub) => _deleteStorageFolderRecursive(sub)),
    ]);
  }

  /// 로컬 저장소: photos/ 하위 월 폴더 순회하며 3개월 초과 삭제
  static Future<void> _cleanupLocal() async {
    try {
      final baseDir = await getApplicationDocumentsDirectory();
      final photosDir = Directory('${baseDir.path}/photos');
      if (!await photosDir.exists()) return;

      final cutoff = _cutoffMonth();

      await for (final entity in photosDir.list()) {
        if (entity is Directory) {
          final folderName = entity.path.split(Platform.pathSeparator).last;
          if (_isOlderThanCutoff(folderName, cutoff)) {
            debugPrint('[PhotoStorage] 🗑 로컬 삭제 대상: $folderName');
            await entity.delete(recursive: true);
            debugPrint('[PhotoStorage] ✅ 로컬 삭제 완료: $folderName');
          }
        }
      }
    } catch (e) {
      debugPrint('[PhotoStorage] ⚠️ 로컬 정리 실패 (무시): $e');
    }
  }

  // ──────────────────────────────────────────────
  // 헬퍼
  // ──────────────────────────────────────────────

  /// 현재 기준으로 정확히 3개월 전 월 반환 (e.g. "2026-02")
  static String _cutoffMonth() {
    final now = DateTime.now();
    int year  = now.year;
    int month = now.month - 3;
    if (month <= 0) {
      month += 12;
      year  -= 1;
    }
    return '$year-${month.toString().padLeft(2, '0')}';
  }

  /// folderName이 cutoff보다 오래됐는지 비교 (사전 순으로 비교 가능한 YYYY-MM 포맷)
  static bool _isOlderThanCutoff(String folderName, String cutoff) {
    // folderName 형식: "2026-02"
    if (!RegExp(r'^\d{4}-\d{2}$').hasMatch(folderName)) return false;
    return folderName.compareTo(cutoff) < 0;
  }

  static String _monthKey(DateTime dt) =>
      '${dt.year}-${dt.month.toString().padLeft(2, '0')}';

  static String _dayKey(DateTime dt) =>
      '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';

  static String _timeKey(DateTime dt) =>
      '${dt.hour.toString().padLeft(2, '0')}${dt.minute.toString().padLeft(2, '0')}${dt.second.toString().padLeft(2, '0')}';

  /// 파일명에 쓸 수 없는 특수문자 제거
  static String _sanitize(String s) =>
      s.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
}
