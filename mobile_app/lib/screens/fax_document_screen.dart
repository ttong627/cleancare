import 'package:flutter/material.dart';
import 'dart:async';

// 실제 앱에서는 cloud_firestore 패키지를 사용합니다.
// import 'package:cloud_firestore/cloud_firestore.dart';

/// 서버(Firestore)에서 내려받은 회사 서류 데이터 모델
class CompanyDocument {
  final String id;
  final String name;
  final String fileName;
  final String fileType;
  final int fileSize;
  final String downloadURL;
  final int uploadedAt;

  CompanyDocument({
    required this.id,
    required this.name,
    required this.fileName,
    required this.fileType,
    required this.fileSize,
    required this.downloadURL,
    required this.uploadedAt,
  });

  /// Firestore 문서 → 객체 변환
  factory CompanyDocument.fromMap(String id, Map<String, dynamic> data) {
    return CompanyDocument(
      id: id,
      name: data['name'] ?? '',
      fileName: data['fileName'] ?? '',
      fileType: data['fileType'] ?? '',
      fileSize: data['fileSize'] ?? 0,
      downloadURL: data['downloadURL'] ?? '',
      uploadedAt: data['uploadedAt'] ?? 0,
    );
  }
}

class FaxDocumentScreen extends StatefulWidget {
  const FaxDocumentScreen({super.key});

  @override
  State<FaxDocumentScreen> createState() => _FaxDocumentScreenState();
}

class _FaxDocumentScreenState extends State<FaxDocumentScreen> {
  CompanyDocument? _selectedDocument;
  final TextEditingController _faxNumberController = TextEditingController();
  bool _isSending = false;
  bool _isLoadingDocs = true;
  bool _isDownloading = false;

  /// 서버에서 받아온 회사 서류 리스트
  List<CompanyDocument> _serverDocuments = [];

  @override
  void initState() {
    super.initState();
    _loadServerDocuments();
  }

  /// Firestore companyDocuments 컬렉션에서 실시간 서류 목록 로드
  Future<void> _loadServerDocuments() async {
    setState(() => _isLoadingDocs = true);

    // 실제 Firestore 연동 시:
    // FirebaseFirestore.instance
    //   .collection('companyDocuments')
    //   .orderBy('uploadedAt', descending: true)
    //   .snapshots()
    //   .listen((snapshot) {
    //     setState(() {
    //       _serverDocuments = snapshot.docs.map((doc) =>
    //         CompanyDocument.fromMap(doc.id, doc.data())
    //       ).toList();
    //       _isLoadingDocs = false;
    //     });
    //   });

    // 시뮬레이션: PC에서 올려둔 서류가 실시간 동기화되는 것을 재현
    await Future.delayed(const Duration(milliseconds: 800));
    setState(() {
      _serverDocuments = [
        CompanyDocument(id: '1', name: '사업자등록증', fileName: '사업자등록증_크린케어.pdf', fileType: 'application/pdf', fileSize: 245000, downloadURL: 'https://storage.example.com/docs/1.pdf', uploadedAt: DateTime.now().millisecondsSinceEpoch),
        CompanyDocument(id: '2', name: '사회적기업인증서', fileName: '사회적기업인증서.pdf', fileType: 'application/pdf', fileSize: 180000, downloadURL: 'https://storage.example.com/docs/2.pdf', uploadedAt: DateTime.now().millisecondsSinceEpoch),
        CompanyDocument(id: '3', name: '자활기업인정서', fileName: '자활기업인정서.pdf', fileType: 'application/pdf', fileSize: 150000, downloadURL: 'https://storage.example.com/docs/3.pdf', uploadedAt: DateTime.now().millisecondsSinceEpoch),
        CompanyDocument(id: '4', name: '여성기업인증서', fileName: '여성기업인증서.jpg', fileType: 'image/jpeg', fileSize: 320000, downloadURL: 'https://storage.example.com/docs/4.jpg', uploadedAt: DateTime.now().millisecondsSinceEpoch),
        CompanyDocument(id: '5', name: '직접생산 증명서', fileName: '직접생산증명서.pdf', fileType: 'application/pdf', fileSize: 190000, downloadURL: 'https://storage.example.com/docs/5.pdf', uploadedAt: DateTime.now().millisecondsSinceEpoch),
        CompanyDocument(id: '6', name: '통장사본', fileName: '통장사본_기업은행.jpg', fileType: 'image/jpeg', fileSize: 280000, downloadURL: 'https://storage.example.com/docs/6.jpg', uploadedAt: DateTime.now().millisecondsSinceEpoch),
        CompanyDocument(id: '7', name: '중소기업확인서', fileName: '중소기업확인서.pdf', fileType: 'application/pdf', fileSize: 210000, downloadURL: 'https://storage.example.com/docs/7.pdf', uploadedAt: DateTime.now().millisecondsSinceEpoch),
        CompanyDocument(id: '8', name: '건물위생관리업영업필증', fileName: '건물위생관리업.pdf', fileType: 'application/pdf', fileSize: 175000, downloadURL: 'https://storage.example.com/docs/8.pdf', uploadedAt: DateTime.now().millisecondsSinceEpoch),
        CompanyDocument(id: '9', name: '저수조청소업영업필증', fileName: '저수조청소업.pdf', fileType: 'application/pdf', fileSize: 165000, downloadURL: 'https://storage.example.com/docs/9.pdf', uploadedAt: DateTime.now().millisecondsSinceEpoch),
        CompanyDocument(id: '10', name: '소독방역업영업필증', fileName: '소독방역업.pdf', fileType: 'application/pdf', fileSize: 155000, downloadURL: 'https://storage.example.com/docs/10.pdf', uploadedAt: DateTime.now().millisecondsSinceEpoch),
      ];
      _isLoadingDocs = false;
    });
  }

  /// 서류 선택 시 다운로드 시뮬레이션
  Future<void> _selectAndDownload(CompanyDocument doc) async {
    setState(() {
      _isDownloading = true;
      _selectedDocument = doc;
    });

    // 실제로는 downloadURL에서 파일 바이트를 내려받아 로컬 임시 디렉토리에 저장
    // final response = await http.get(Uri.parse(doc.downloadURL));
    // final tempDir = await getTemporaryDirectory();
    // final file = File('${tempDir.path}/${doc.fileName}');
    // await file.writeAsBytes(response.bodyBytes);

    await Future.delayed(const Duration(milliseconds: 600));

    setState(() => _isDownloading = false);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('📥 [${doc.name}] 다운로드 완료! 팩스 번호를 입력하세요.'),
          backgroundColor: const Color(0xFF14B8A6),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _sendFax() async {
    if (_selectedDocument == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('전송할 서류를 선택해주세요.')));
      return;
    }
    if (_faxNumberController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('팩스 번호를 입력해주세요.')));
      return;
    }

    setState(() => _isSending = true);

    // 팩스 API 전송 시뮬레이션
    await Future.delayed(const Duration(seconds: 2));

    setState(() => _isSending = false);

    if (mounted) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('팩스 전송 완료 ✅', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
          content: Text('[${_selectedDocument!.name}] 문서가\n${_faxNumberController.text} 번호로 성공적으로 전송되었습니다.'),
          actions: [
            ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx);
                Navigator.pop(context);
              },
              child: const Text('확인'),
            )
          ],
        ),
      );
    }
  }

  /// 파일 크기 포맷
  String _formatSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  /// 파일 타입별 아이콘
  IconData _fileIcon(String type) {
    if (type.startsWith('image/')) return Icons.image;
    if (type == 'application/pdf') return Icons.picture_as_pdf;
    return Icons.insert_drive_file;
  }

  Color _fileIconColor(String type) {
    if (type.startsWith('image/')) return Colors.blue;
    if (type == 'application/pdf') return Colors.red;
    return Colors.grey;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: const Text('현장 즉시 팩스 발송', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87)),
        backgroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.black87),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 안내 문구
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.cloud_download, color: Color(0xFF3B82F6)),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'PC에서 등록한 회사 서류가 서버에서 자동으로 동기화됩니다.\n서류를 선택하면 스마트폰으로 다운로드 후 즉시 팩스 전송됩니다.',
                        style: TextStyle(color: Color(0xFF1E3A8A), fontSize: 13, height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // 1. 서류 선택 (서버에서 불러온 리스트)
              const Text('1. 발송할 서류 선택', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.black87)),
              const SizedBox(height: 4),
              Text('서버에 등록된 서류 ${_serverDocuments.length}건', style: const TextStyle(fontSize: 12, color: Colors.grey)),
              const SizedBox(height: 12),

              if (_isLoadingDocs)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(40),
                    child: Column(
                      children: [
                        CircularProgressIndicator(),
                        SizedBox(height: 12),
                        Text('서버에서 서류 목록 불러오는 중...', style: TextStyle(color: Colors.grey)),
                      ],
                    ),
                  ),
                )
              else if (_serverDocuments.isEmpty)
                Container(
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: const Center(
                    child: Column(
                      children: [
                        Icon(Icons.folder_open, size: 48, color: Colors.grey),
                        SizedBox(height: 12),
                        Text('등록된 서류가 없습니다.', style: TextStyle(color: Colors.grey, fontSize: 15)),
                        SizedBox(height: 4),
                        Text('PC 관리자에게 서류 등록을 요청하세요.', style: TextStyle(color: Colors.grey, fontSize: 12)),
                      ],
                    ),
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _serverDocuments.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final doc = _serverDocuments[index];
                    final isSelected = _selectedDocument?.id == doc.id;

                    return GestureDetector(
                      onTap: () => _selectAndDownload(doc),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: isSelected ? const Color(0xFF3B82F6) : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isSelected ? const Color(0xFF2563EB) : Colors.grey.shade300,
                            width: isSelected ? 2 : 1,
                          ),
                          boxShadow: isSelected ? [
                            BoxShadow(color: const Color(0xFF3B82F6).withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 4))
                          ] : [],
                        ),
                        child: Row(
                          children: [
                            // 파일 아이콘
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: isSelected ? Colors.white24 : Colors.grey.shade100,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                _fileIcon(doc.fileType),
                                size: 24,
                                color: isSelected ? Colors.white : _fileIconColor(doc.fileType),
                              ),
                            ),
                            const SizedBox(width: 14),
                            // 서류 정보
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    doc.name,
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 15,
                                      color: isSelected ? Colors.white : Colors.black87,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${doc.fileName}  ·  ${_formatSize(doc.fileSize)}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: isSelected ? Colors.white70 : Colors.grey,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            // 체크 아이콘
                            if (isSelected)
                              _isDownloading
                                ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                : const Icon(Icons.check_circle, color: Colors.white, size: 24),
                          ],
                        ),
                      ),
                    );
                  },
                ),

              const SizedBox(height: 32),

              // 2. 팩스 번호 입력
              const Text('2. 수신 팩스 번호', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.black87)),
              const SizedBox(height: 12),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: TextField(
                  controller: _faxNumberController,
                  keyboardType: TextInputType.phone,
                  style: const TextStyle(fontSize: 18, letterSpacing: 2, fontWeight: FontWeight.bold),
                  decoration: const InputDecoration(
                    hintText: '031-123-4567',
                    hintStyle: TextStyle(color: Colors.grey, fontWeight: FontWeight.normal, letterSpacing: 0),
                    prefixIcon: Icon(Icons.print, color: Colors.grey),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  ),
                ),
              ),
              const SizedBox(height: 40),

              // 3. 발송 버튼
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton.icon(
                  onPressed: _isSending ? null : _sendFax,
                  icon: _isSending
                    ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.send, color: Colors.white),
                  label: Text(
                    _isSending ? '팩스 전송 중...' : '즉시 발송',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F172A),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                ),
              ),

              // 선택된 서류 상태 표시
              if (_selectedDocument != null)
                Container(
                  margin: const EdgeInsets.only(top: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFBBF7D0)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle, color: Colors.green, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '선택됨: ${_selectedDocument!.name} (${_formatSize(_selectedDocument!.fileSize)})',
                          style: const TextStyle(color: Color(0xFF166534), fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
