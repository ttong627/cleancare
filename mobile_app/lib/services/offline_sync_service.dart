import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'photo_storage_service.dart';

/// 현장 작업자 전용 — 오프라인 동기화 엔진
///
/// 1. 촬영 즉시 로컬(앱 내부 저장소)에 사진 보관
/// 2. 인터넷 연결 감지 시 Firebase Storage로 백그라운드 업로드
/// 3. 업로드 완료 파일은 로컬에서 삭제하여 폰 용량 절약
class OfflineSyncService {
  static const _pendingKey = 'pending_photo_paths';

  // ──────────────────────────────────────────────
  // 초기화
  // ──────────────────────────────────────────────

  static Future<void> initializeDB() async {
    debugPrint('[OfflineSync] 로컬 저장소 초기화 완료');
    // 앱 시작 시 3개월 이상 된 사진 자동 정리
    await PhotoStorageService.cleanupOldPhotos();
  }

  // ──────────────────────────────────────────────
  // 촬영 즉시 로컬 저장 (인터넷 무관)
  // ──────────────────────────────────────────────

  static Future<String> savePhotoLocally({
    required String jobId,
    required String jobName,
    required String workStep,
    required double latitude,
    required double longitude,
    required Uint8List imageBytes,
  }) async {
    final capturedAt = DateTime.now();

    // 1) 로컬 파일로 저장
    final localPath = await PhotoStorageService.savePhotoLocally(
      jobId      : jobId,
      jobName    : jobName,
      workStep   : workStep,
      imageBytes : imageBytes,
      capturedAt : capturedAt,
    );

    // 2) 업로드 대기 목록에 추가 (SharedPreferences로 관리)
    final prefs = await SharedPreferences.getInstance();
    final pending = prefs.getStringList(_pendingKey) ?? [];
    pending.add([
      localPath,
      jobId,
      jobName,
      workStep,
      capturedAt.toIso8601String(),
    ].join('|'));
    await prefs.setStringList(_pendingKey, pending);

    debugPrint('[OfflineSync] 💾 로컬 저장 완료 ($workStep) → 업로드 대기: ${pending.length}건');
    return localPath;
  }

  // ──────────────────────────────────────────────
  // 백그라운드 동기화 (연결 시 호출)
  // ──────────────────────────────────────────────

  static Future<void> syncPendingPhotos() async {
    final prefs = await SharedPreferences.getInstance();
    final pending = List<String>.from(prefs.getStringList(_pendingKey) ?? []);
    if (pending.isEmpty) return;

    debugPrint('[OfflineSync] 📡 연결 감지! 업로드 대기 사진: ${pending.length}건');

    final stillPending = <String>[];

    for (final entry in pending) {
      final parts = entry.split('|');
      if (parts.length < 5) continue;

      final localPath   = parts[0];
      final jobId       = parts[1];
      final jobName     = parts[2];
      final workStep    = parts[3];
      final capturedAt  = DateTime.parse(parts[4]);

      try {
        final file = File(localPath);
        if (!await file.exists()) continue; // 이미 삭제된 파일은 건너뜀

        final imageBytes = await file.readAsBytes();

        await PhotoStorageService.uploadPhoto(
          jobId      : jobId,
          jobName    : jobName,
          workStep   : workStep,
          imageBytes : imageBytes,
          capturedAt : capturedAt,
        );

        // 업로드 성공 → 로컬 파일 삭제
        await file.delete();
        debugPrint('[OfflineSync] ✅ 업로드 완료 → 로컬 삭제: $localPath');
      } catch (e) {
        debugPrint('[OfflineSync] ⚠️ 업로드 실패 (재시도 예약): $e');
        stillPending.add(entry); // 실패 시 다음 연결 때 재시도
      }
    }

    await prefs.setStringList(_pendingKey, stillPending);
    debugPrint('[OfflineSync] 동기화 완료. 남은 대기: ${stillPending.length}건');
  }

  // ──────────────────────────────────────────────
  // 현황 조회
  // ──────────────────────────────────────────────

  static Future<int> getPendingCount() async {
    final prefs = await SharedPreferences.getInstance();
    return (prefs.getStringList(_pendingKey) ?? []).length;
  }
}
