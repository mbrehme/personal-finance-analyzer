/**
 * @file IconRenderer.tsx
 * @description Dynamische Icon-Rendering-Komponente für Lucide-Icons mit sicherem Fallback.
 * @module components/IconRenderer
 */

import React from 'react';
import {
  Landmark,
  Wallet,
  Home,
  ShoppingBag,
  Coffee,
  DollarSign,
  Key,
  Car,
  Plane,
  HeartPulse,
  GraduationCap,
  Folder,
  Tag,
  Gift,
  Zap,
  Shield,
  CreditCard,
  Building,
  Utensils,
  Film,
  Smartphone,
  Tv,
  Briefcase,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Truck,
  Music,
  BookOpen,
  Gamepad2,
  Baby,
  Dog,
  Dumbbell,
  Sparkles,
  Package,
  Clock,
  LucideProps,
} from 'lucide-react';

const ICON_MAP: Record<string, React.FC<LucideProps>> = {
  Landmark,
  Wallet,
  Home,
  ShoppingBag,
  Coffee,
  DollarSign,
  Key,
  Car,
  Plane,
  HeartPulse,
  GraduationCap,
  Folder,
  Tag,
  Gift,
  Zap,
  Shield,
  CreditCard,
  Building,
  Utensils,
  Film,
  Smartphone,
  Tv,
  Briefcase,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Truck,
  Music,
  BookOpen,
  Gamepad2,
  Baby,
  Dog,
  Dumbbell,
  Sparkles,
  Package,
  Clock,
};

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);

export interface IconRendererProps extends LucideProps {
  name?: string;
}

/**
 * Rendert ein Lucide-Icon anhand seines Namens mit konfigurierbarer Größe und Farbe.
 */
export const IconRenderer: React.FC<IconRendererProps> = ({
  name,
  className = 'w-5 h-5',
  ...props
}) => {
  const IconComponent = (name && ICON_MAP[name]) || Tag;
  return <IconComponent className={className} {...props} />;
};
