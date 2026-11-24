import { Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';

// Computador: QR code (e link) da página /instalar, para abrir no celular e instalar o app.
export function InstalarNoCelularDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const url = `${window.location.origin}/instalar`;

    const copiar = () =>
        navigator.clipboard.writeText(url).then(
            () => toast({ title: 'Link copiado', variant: 'success' }),
            () => toast({ title: 'Não foi possível copiar o link', variant: 'error' }),
        );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle>Instalar no celular</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="mx-auto w-fit rounded-xl border bg-white p-3">
                        <QRCodeSVG value={url} size={192} level="M" />
                    </div>
                    <ol className="list-decimal space-y-1 pl-5 text-sm text-[hsl(var(--muted-foreground))]">
                        <li>Aponte a câmera do celular para o QR code</li>
                        <li>Siga os passos da página (no iPhone, use o Safari)</li>
                        <li>Abra pelo novo ícone e entre com seu e-mail e senha</li>
                    </ol>
                    <div className="flex gap-2">
                        <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Link de instalação" />
                        <Button variant="outline" size="icon" onClick={copiar} aria-label="Copiar link">
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
