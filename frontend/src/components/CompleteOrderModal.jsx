import { useState, useRef } from 'react';
import { X, Upload, Loader2, CheckCircle2, Trash2 } from 'lucide-react';
import api from '../api/client';

export default function CompleteOrderModal({ order, onDone, onClose }) {
  const [files, setFiles] = useState([]); // [{file, preview}]
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const addFiles = (newFiles) => {
    const valid = Array.from(newFiles).filter(f => f.type.startsWith('image/'));
    setFiles(prev => [...prev, ...valid.map(f => ({ file: f, preview: URL.createObjectURL(f) }))].slice(0, 5));
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleConfirm = async () => {
    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach(({ file }) => fd.append('proofs', file));
      const res = await api.patch(`/orders/${order.id}/complete`, fd);
      onDone(res.data);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">Mark as Completed</h3>
            <p className="text-sm text-gray-500 mt-0.5">{order.order_number} · {order.customer_name}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">Upload photos of the transport document and packed order as proof (optional).</p>

          {/* Thumbnails */}
          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {files.map((f, idx) => (
                <div key={idx} className="relative rounded-lg overflow-hidden border border-gray-200 aspect-square bg-gray-50">
                  <img src={f.preview} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                  <button onClick={() => removeFile(idx)}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full p-0.5 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {files.length < 5 && (
                <button onClick={() => fileRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-gray-200 hover:border-green-300 hover:bg-green-50/40 flex items-center justify-center transition-colors">
                  <Upload className="w-5 h-5 text-gray-400" />
                </button>
              )}
            </div>
          )}

          {/* Drop zone — shown when no files yet */}
          {files.length === 0 && (
            <div
              className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors border-gray-200 hover:border-green-300 hover:bg-green-50/40"
              onClick={() => fileRef.current?.click()}
              onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              onDragOver={e => e.preventDefault()}
            >
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Click or drag photos here</p>
              <p className="text-xs text-gray-400 mt-1">Transport challan, LR copy, packed box — up to 5 photos</p>
            </div>
          )}

          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => addFiles(e.target.files)} />

          <div className="flex gap-2">
            <button onClick={handleConfirm} disabled={uploading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {uploading ? 'Saving...' : 'Confirm Completed'}
            </button>
            <button onClick={onClose}
              className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>

          <p className="text-xs text-center text-gray-400">Photos are optional — you can confirm without uploading</p>
        </div>
      </div>
    </div>
  );
}
