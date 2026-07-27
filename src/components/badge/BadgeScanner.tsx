import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Worker } from 'tesseract.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Loader2, Save, RotateCcw } from 'lucide-react';
import { supabase } from '@/supabaseClient';
import { toast } from '@/hooks/use-toast';
import { parseBadgeText } from '@/lib/badgeParser';
import { normalizeImageOrientation, OrientationDebug } from '@/lib/imageOrientation';
import { BadgeVisitorDraft, EMPTY_BADGE_DRAFT } from '@/types/badgeVisitor';

const LAST_EVENT_KEY = 'badgeScanner.lastEventName';

interface BadgeScannerProps {
  onSaved?: () => void;
}

const BadgeScanner: React.FC<BadgeScannerProps> = ({ onSaved }) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [debugInfo, setDebugInfo] = useState<OrientationDebug | null>(null);
  const [draft, setDraft] = useState<BadgeVisitorDraft>(() => ({
    ...EMPTY_BADGE_DRAFT,
    event_name: localStorage.getItem(LAST_EVENT_KEY) || '',
  }));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Promise<Worker> | null>(null);

  const getWorker = useCallback(async () => {
    if (!workerRef.current) {
      const { createWorker } = await import('tesseract.js');
      workerRef.current = createWorker('eng');
    }
    return workerRef.current;
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.then((w) => w.terminate()).catch(() => {});
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setDraft({
      ...EMPTY_BADGE_DRAFT,
      event_name: localStorage.getItem(LAST_EVENT_KEY) || '',
    });
    setIsScanning(true);
    setDebugInfo(null);

    const { blob: normalized, debug } = await normalizeImageOrientation(file);
    setDebugInfo(debug);
    const previewUrl = URL.createObjectURL(normalized);
    setImagePreview(previewUrl);

    try {
      const worker = await getWorker();
      const { data } = await worker.recognize(normalized);
      const rawText = data.text || '';
      const guessed = parseBadgeText(rawText);
      setDraft((prev) => ({
        ...prev,
        ...guessed,
        event_name: guessed.event_name || prev.event_name,
        raw_ocr_text: rawText,
      }));
      if (!rawText.trim()) {
        toast({
          title: 'No text detected',
          description: 'Fill in the fields below manually, or retake the photo.',
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: 'Scan failed',
        description: 'Could not read the badge. Fill in the fields manually.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const updateField = (field: keyof BadgeVisitorDraft) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setDraft((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const resetAll = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setDraft({
      ...EMPTY_BADGE_DRAFT,
      event_name: localStorage.getItem(LAST_EVENT_KEY) || '',
    });
  };

  const handleSave = async () => {
    if (!draft.name?.trim() && !draft.company?.trim()) {
      toast({
        title: 'Add at least a name or company',
        description: 'Nothing worth saving yet.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from('badge_visitors').insert([draft]);
    setIsSaving(false);

    if (error) {
      console.error(error);
      toast({
        title: 'Save failed',
        description: error.message.includes('does not exist')
          ? 'The badge_visitors table doesn’t exist yet — run docs/badge_visitors_schema.sql in Supabase first.'
          : error.message,
        variant: 'destructive',
      });
      return;
    }

    if (draft.event_name) localStorage.setItem(LAST_EVENT_KEY, draft.event_name);
    toast({ title: 'Visitor saved', description: draft.name || draft.company || 'Saved to visitor log.' });
    resetAll();
    onSaved?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scan a Badge</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {!imagePreview ? (
          <Button onClick={() => fileInputRef.current?.click()} size="lg" className="w-full">
            <Camera className="mr-2 h-5 w-5" />
            Take Photo of Badge
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-4">
              <img
                src={imagePreview}
                alt="Captured badge"
                className="h-40 w-40 shrink-0 rounded-md border object-cover"
              />
              <div className="flex flex-1 flex-col justify-center gap-2">
                {isScanning ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reading badge...
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Review the fields below, fix anything the scan got wrong, then save.
                  </p>
                )}
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isScanning}>
                  <Camera className="mr-2 h-4 w-4" />
                  Retake Photo
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={draft.name || ''} onChange={updateField('name')} disabled={isScanning} />
              </div>
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={draft.title || ''} onChange={updateField('title')} disabled={isScanning} />
              </div>
              <div>
                <Label htmlFor="company">Company</Label>
                <Input id="company" value={draft.company || ''} onChange={updateField('company')} disabled={isScanning} />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={draft.location || ''} onChange={updateField('location')} disabled={isScanning} />
              </div>
              <div>
                <Label htmlFor="badge_type">Badge Type</Label>
                <Input id="badge_type" value={draft.badge_type || ''} onChange={updateField('badge_type')} disabled={isScanning} />
              </div>
              <div>
                <Label htmlFor="event_name">Event</Label>
                <Input id="event_name" value={draft.event_name || ''} onChange={updateField('event_name')} disabled={isScanning} />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes (what you talked about, follow-up needed, etc.)</Label>
              <Textarea id="notes" value={draft.notes || ''} onChange={updateField('notes')} disabled={isScanning} rows={2} />
            </div>

            {debugInfo && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                <p className="font-semibold">Debug info (temporary, for troubleshooting the scanner)</p>
                <p>method: {debugInfo.method}</p>
                {debugInfo.beforeDims && <p>image dimensions: {debugInfo.beforeDims}</p>}
                {debugInfo.afterDims && <p>after normalize: {debugInfo.afterDims}</p>}
                {debugInfo.blobSize !== undefined && <p>normalized blob size: {debugInfo.blobSize} bytes</p>}
                {debugInfo.error && <p className="font-semibold text-red-700">error: {debugInfo.error}</p>}
              </div>
            )}

            {draft.raw_ocr_text && (
              <details className="text-sm text-muted-foreground" open>
                <summary className="cursor-pointer select-none">Raw scanned text</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">{draft.raw_ocr_text}</pre>
              </details>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isScanning || isSaving} className="flex-1">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Visitor
              </Button>
              <Button variant="outline" onClick={resetAll} disabled={isSaving}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Discard
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BadgeScanner;
