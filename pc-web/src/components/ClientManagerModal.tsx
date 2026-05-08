'use client';

import { useState, useEffect } from 'react';
import { Client, ClientManager } from '@/schema';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { X, Plus, Trash2, Edit2, Save, Building2, User, Mail, Phone, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ClientManagerModal({ isOpen, onClose }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, 'clients'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });
    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!editingClient?.name || !editingClient.businessNumber) {
      toast.error('거래처명과 사업자등록번호는 필수입니다.');
      return;
    }

    try {
      if (editingClient.id) {
        await setDoc(doc(db, 'clients', editingClient.id), {
          ...editingClient,
          updatedAt: Date.now()
        }, { merge: true });
        toast.success('거래처 정보가 수정되었습니다.');
      } else {
        await addDoc(collection(db, 'clients'), {
          ...editingClient,
          managers: editingClient.managers || [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        toast.success('신규 거래처가 등록되었습니다.');
      }
      setEditingClient(null);
    } catch (error) {
      toast.error('저장에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('정말로 이 거래처를 삭제하시겠습니까? 관련 데이터는 복구할 수 없습니다.')) {
      try {
        await deleteDoc(doc(db, 'clients', id));
        toast.success('삭제되었습니다.');
      } catch (error) {
        toast.error('삭제에 실패했습니다.');
      }
    }
  };

  const addManager = () => {
    setEditingClient(prev => ({
      ...prev,
      managers: [...(prev?.managers || []), { id: Date.now().toString(), name: '', email: '', contact: '', memo: '' }]
    }));
  };

  const updateManager = (index: number, field: keyof ClientManager, value: string) => {
    setEditingClient(prev => {
      if (!prev || !prev.managers) return prev;
      const newManagers = [...prev.managers];
      newManagers[index] = { ...newManagers[index], [field]: value };
      return { ...prev, managers: newManagers };
    });
  };

  const removeManager = (index: number) => {
    setEditingClient(prev => {
      if (!prev || !prev.managers) return prev;
      const newManagers = prev.managers.filter((_, i) => i !== index);
      return { ...prev, managers: newManagers };
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="text-teal-600" /> 
            거래처 관리 (전자세금계산서 발행용)
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Client List */}
          <div className="w-1/3 border-r border-slate-100 bg-slate-50/50 flex flex-col">
            <div className="p-4 border-b border-slate-100">
              <button 
                onClick={() => setEditingClient({ name: '', businessNumber: '', managers: [] })}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <Plus size={18} /> 신규 거래처 등록
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {clients.map(client => (
                <div 
                  key={client.id}
                  onClick={() => setEditingClient(client)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${editingClient?.id === client.id ? 'bg-white border-teal-500 ring-1 ring-teal-500 shadow-md' : 'bg-white border-slate-200 hover:border-teal-300'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-slate-800">{client.name}</h3>
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={14}/></button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">{client.businessNumber}</p>
                  <p className="text-xs text-teal-600 mt-2 font-medium">등록된 담당자: {client.managers?.length || 0}명</p>
                </div>
              ))}
              {clients.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-sm">등록된 거래처가 없습니다.</div>
              )}
            </div>
          </div>

          {/* Right: Edit Form */}
          <div className="flex-1 overflow-y-auto p-8 bg-white">
            {editingClient ? (
              <div className="space-y-8 animate-in fade-in duration-200">
                <div className="flex justify-between items-end pb-4 border-b border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800">
                    {editingClient.id ? '거래처 정보 수정' : '새 거래처 등록'}
                  </h3>
                  <button onClick={handleSave} className="px-5 py-2.5 bg-slate-900 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors">
                    <Save size={16} /> 저장하기
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">거래처명</label>
                    <input type="text" value={editingClient.name || ''} onChange={e => setEditingClient({...editingClient, name: e.target.value})} placeholder="예: (주)크린케어본사" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">사업자등록번호</label>
                    <input type="text" value={editingClient.businessNumber || ''} onChange={e => setEditingClient({...editingClient, businessNumber: e.target.value})} placeholder="123-45-67890" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-bold text-slate-700">담당자 목록 (복수 등록 가능)</label>
                    <button onClick={addManager} className="px-3 py-1.5 bg-teal-50 text-teal-700 rounded-md text-sm font-bold flex items-center gap-1 border border-teal-200 hover:bg-teal-100">
                      <Plus size={14} /> 담당자 추가
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {(!editingClient.managers || editingClient.managers.length === 0) && (
                      <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400 text-sm">
                        세금계산서 수신을 위한 담당자를 추가해주세요.
                      </div>
                    )}
                    {editingClient.managers?.map((manager, index) => (
                      <div key={manager.id || index} className="p-5 border border-slate-200 rounded-xl bg-white shadow-sm relative group">
                        <button onClick={() => removeManager(index)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={18} />
                        </button>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="flex items-center gap-1 text-xs font-bold text-slate-500 mb-1"><User size={12}/> 담당자명</label>
                            <input type="text" value={manager.name} onChange={e => updateManager(index, 'name', e.target.value)} placeholder="홍길동 대리" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-teal-500 outline-none" />
                          </div>
                          <div>
                            <label className="flex items-center gap-1 text-xs font-bold text-slate-500 mb-1"><Phone size={12}/> 연락처</label>
                            <input type="text" value={manager.contact} onChange={e => updateManager(index, 'contact', e.target.value)} placeholder="010-0000-0000" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-teal-500 outline-none" />
                          </div>
                          <div className="col-span-2">
                            <label className="flex items-center gap-1 text-xs font-bold text-slate-500 mb-1">
                              <Mail size={12}/> 이메일 주소 <span className="text-red-500">* (계산서 수신용)</span>
                            </label>
                            <input type="email" value={manager.email} onChange={e => updateManager(index, 'email', e.target.value)} placeholder="example@email.com" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-teal-500 outline-none" />
                          </div>
                          <div className="col-span-2">
                            <label className="flex items-center gap-1 text-xs font-bold text-slate-500 mb-1"><FileText size={12}/> 비고</label>
                            <input type="text" value={manager.memo || ''} onChange={e => updateManager(index, 'memo', e.target.value)} placeholder="계산서 발행 시 특이사항 등 메모" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-teal-500 outline-none" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Building2 size={48} className="mb-4 text-slate-200" />
                <p>좌측에서 거래처를 선택하거나 신규 등록해주세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
