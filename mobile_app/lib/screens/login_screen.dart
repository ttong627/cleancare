import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  final _emailCtrl    = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _formKey      = GlobalKey<FormState>();

  late AnimationController _animCtrl;
  late Animation<double>   _fadeAnim;

  bool _isLoading  = false;
  bool _obscure    = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _animCtrl.forward();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() { _isLoading = true; _error = null; });

    try {
      await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _emailCtrl.text.trim(),
        password: _passwordCtrl.text,
      );
      // authStateChanges 스트림이 자동으로 홈 화면으로 전환
    } on FirebaseAuthException catch (e) {
      setState(() {
        _error = switch (e.code) {
          'user-not-found'  => '등록되지 않은 이메일입니다.',
          'wrong-password'  => '비밀번호가 올바르지 않습니다.',
          'invalid-email'   => '이메일 형식이 올바르지 않습니다.',
          'user-disabled'   => '비활성화된 계정입니다. 관리자에게 문의하세요.',
          'too-many-requests' => '잠시 후 다시 시도해 주세요.',
          _                 => '로그인 실패: ${e.message}',
        };
      });
    } catch (e) {
      setState(() => _error = '오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeAnim,
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 60),

                  // 로고
                  Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(color: const Color(0xFF005BB7).withOpacity(0.12), blurRadius: 30, spreadRadius: 4, offset: const Offset(0, 8)),
                        ],
                      ),
                      child: Image.asset(
                        'assets/images/logo1.png',
                        height: 72,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) =>
                          const Icon(Icons.cleaning_services_rounded, size: 72, color: Color(0xFF005BB7)),
                      ),
                    ),
                  ),

                  const SizedBox(height: 40),
                  const Text(
                    '크린케어시스템\n현장팀 로그인',
                    style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900, height: 1.2, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    '관리자에게 발급받은 이메일과 비밀번호로\n로그인하세요.',
                    style: TextStyle(color: Color(0xFF64748B), fontSize: 14, height: 1.6),
                  ),

                  const SizedBox(height: 40),

                  // 이메일
                  TextFormField(
                    controller: _emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    style: const TextStyle(fontSize: 16),
                    decoration: InputDecoration(
                      labelText: '이메일',
                      prefixIcon: const Icon(Icons.email_outlined, color: Color(0xFF94A3B8)),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty) ? '이메일을 입력해 주세요' : null,
                  ),

                  const SizedBox(height: 16),

                  // 비밀번호
                  TextFormField(
                    controller: _passwordCtrl,
                    obscureText: _obscure,
                    style: const TextStyle(fontSize: 16),
                    decoration: InputDecoration(
                      labelText: '비밀번호',
                      prefixIcon: const Icon(Icons.lock_outline, color: Color(0xFF94A3B8)),
                      suffixIcon: IconButton(
                        icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: const Color(0xFF94A3B8)),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                    validator: (v) => (v == null || v.isEmpty) ? '비밀번호를 입력해 주세요' : null,
                    onFieldSubmitted: (_) => _login(),
                  ),

                  // 오류 메시지
                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF0F0),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFFFCDD2)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline, color: Color(0xFFBA1A1A), size: 20),
                          const SizedBox(width: 10),
                          Expanded(child: Text(_error!, style: const TextStyle(color: Color(0xFFBA1A1A), fontSize: 13))),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 32),

                  // 로그인 버튼
                  SizedBox(
                    width: double.infinity,
                    height: 58,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _login,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF005BB7),
                        elevation: 4,
                        shadowColor: const Color(0xFF005BB7).withOpacity(0.4),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: _isLoading
                        ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                        : const Text('로그인', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
                    ),
                  ),

                  const SizedBox(height: 24),
                  const Center(
                    child: Text(
                      '계정이 없으신가요? 관리자에게 계정 발급을 요청하세요.',
                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
