import { useState } from 'react';
import { trpc } from '@/services/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { maskCpf, maskCnpj, maskTelefone } from '@/lib/masks';

type PessoaData = {
    id?: number;
    tipo?: string;
    nome?: string;
    cpf_cnpj?: string | null;
    telefone?: string | null;
    email?: string | null;
    data_nascimento?: string | null;
    observacao?: string | null;
    status?: string;
};

type Props = {
    onSuccess: () => void;
    editData?: PessoaData;
};

export function PessoaForm({ onSuccess, editData }: Props) {
    const isEdit = !!editData?.id;
    const [open, setOpen] = useState(false);

    const [tipo, setTipo] = useState(editData?.tipo ?? 'CLIENTE');
    const [nome, setNome] = useState(editData?.nome ?? '');
    const [cpf_cnpj, setCpfCnpj] = useState(editData?.cpf_cnpj ?? '');
    const [telefone, setTelefone] = useState(editData?.telefone ?? '');
    const [email, setEmail] = useState(editData?.email ?? '');
    const [data_nascimento, setDataNascimento] = useState(editData?.data_nascimento ?? '');
    const [observacao, setObservacao] = useState(editData?.observacao ?? '');
    const [status, setStatus] = useState(editData?.status ?? 'ATIVO');

    const createMut = trpc.pessoas.create.useMutation({
        onSuccess: () => { onSuccess(); setOpen(false); resetForm(); },
    });
    const updateMut = trpc.pessoas.update.useMutation({
        onSuccess: () => { onSuccess(); setOpen(false); },
    });

    function resetForm() {
        setTipo('CLIENTE');
        setNome('');
        setCpfCnpj('');
        setTelefone('');
        setEmail('');
        setDataNascimento('');
        setObservacao('');
        setStatus('ATIVO');
    }

    function handleSubmit() {
        if (isEdit && editData?.id) {
            updateMut.mutate({
                id: editData.id,
                tipo: tipo as any,
                nome,
                cpf_cnpj: cpf_cnpj || null,
                telefone: telefone || null,
                email: email || null,
                data_nascimento: data_nascimento || null,
                observacao: observacao || null,
                status: status as any,
            });
        } else {
            createMut.mutate({
                tipo: tipo as any,
                nome,
                cpf_cnpj: cpf_cnpj || undefined,
                telefone: telefone || undefined,
                email: email || undefined,
                data_nascimento: data_nascimento || undefined,
                observacao: observacao || undefined,
            });
        }
    }

    function handleOpen(open: boolean) {
        setOpen(open);
        if (open && editData) {
            setTipo(editData.tipo ?? 'CLIENTE');
            setNome(editData.nome ?? '');
            setCpfCnpj(editData.cpf_cnpj ?? '');
            setTelefone(editData.telefone ?? '');
            setEmail(editData.email ?? '');
            setDataNascimento(editData.data_nascimento ?? '');
            setObservacao(editData.observacao ?? '');
            setStatus(editData.status ?? 'ATIVO');
        }
    }

    const isPending = createMut.isPending || updateMut.isPending;
    const error = createMut.error || updateMut.error;

    return (
        <Dialog open={open} onOpenChange={handleOpen}>
            <DialogTrigger asChild>
                {isEdit ? (
                    <Button variant="ghost" size="sm" className="text-xs">
                        Editar
                    </Button>
                ) : (
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Nova Pessoa
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Editar Pessoa' : 'Nova Pessoa'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Tipo</Label>
                            <Select value={tipo} onValueChange={setTipo}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="CLIENTE">Cliente</SelectItem>
                                    <SelectItem value="FORNECEDOR">Fornecedor</SelectItem>
                                    <SelectItem value="AMBOS">Ambos</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {isEdit && (
                            <div className="space-y-1.5">
                                <Label>Status</Label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ATIVO">Ativo</SelectItem>
                                        <SelectItem value="INATIVO">Inativo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label>Nome *</Label>
                        <Input value={nome} onChange={(e) => setNome(e.target.value)} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>CPF/CNPJ</Label>
                            <Input
                                value={cpf_cnpj}
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    if (tipo === 'FORNECEDOR') {
                                        setCpfCnpj(maskCnpj(raw));
                                    } else {
                                        setCpfCnpj(maskCpf(raw));
                                    }
                                }}
                                placeholder={tipo === 'FORNECEDOR' ? '00.000.000/0000-00' : '000.000.000-00'}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Telefone</Label>
                            <Input
                                value={telefone}
                                onChange={(e) => setTelefone(maskTelefone(e.target.value))}
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>E-mail</Label>
                            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Data de Nascimento</Label>
                            <Input
                                type="date"
                                value={data_nascimento}
                                onChange={(e) => setDataNascimento(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Observação</Label>
                        <Textarea
                            value={observacao}
                            onChange={(e) => setObservacao(e.target.value)}
                            rows={2}
                            placeholder="Opcional"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={!nome.trim() || isPending}>
                        {isPending ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar'}
                    </Button>
                </DialogFooter>

                {error && <p className="text-sm text-red-500 mt-2">{error.message}</p>}
            </DialogContent>
        </Dialog>
    );
}
