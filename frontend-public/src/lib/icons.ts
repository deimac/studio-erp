import { Droplets, Feather, Flower2, HandHeart, Leaf, Sparkles, Waves, Heart, Sun, Moon, type LucideIcon } from 'lucide-react';

const MAPA: Record<string, LucideIcon> = { Sparkles, Feather, HandHeart, Droplets, Flower2, Leaf, Waves, Heart, Sun, Moon };

export function iconeProtocolo(nome?: string | null): LucideIcon {
    return (nome && MAPA[nome]) || Sparkles;
}
