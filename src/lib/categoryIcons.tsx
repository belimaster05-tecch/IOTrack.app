import {
  // Educación
  BookOpen, GraduationCap, PenLine, Library, NotebookPen,
  // Tecnología
  Laptop, Monitor, Tablet, Wifi, Cpu, Printer, Smartphone, HardDrive, Plug,
  // Ciencia
  FlaskConical, Microscope, Atom, TestTube,
  // Arte
  Palette, Scissors, PenTool, Brush,
  // Música / AV
  Music2, Headphones, Mic2, Camera, Video, Projector, Radio,
  // Deportes
  Dumbbell, Trophy, Bike, Target,
  // Herramientas
  Wrench, Hammer, HardHat, Drill,
  // Cocina
  UtensilsCrossed, ChefHat, Coffee, Wine, CupSoda, Apple, ShoppingBasket,
  // Ropa / Moda
  Shirt, ShoppingBag, Gem, Crown, Watch, Tag,
  // Hogar
  Home, Sofa, Bed, Bath, Lamp, Armchair, DoorOpen, Tv,
  // Salud / Médico
  Heart, Stethoscope, Pill, Syringe, Thermometer, Cross,
  // Transporte
  Car, Truck, Bus, Plane, Ship, Fuel,
  // Jardín / Naturaleza
  Flower2, Leaf, Trees, Sun, Cloud, Snowflake,
  // Mascotas / Bebés
  PawPrint, Baby,
  // Ocio / Gaming
  Gamepad2, Gift, Star,
  // Oficina / General
  Briefcase, Folder, FileText, ClipboardList, Package, Archive, Layers,
  // Espacios
  Building2, Globe, Shield, Lock, Zap, Recycle,
} from 'lucide-react';

export const CATEGORY_ICON_LIST = [
  // ── Educación ──────────────────────────────
  { name: 'book-open',        label: 'Libros',           Icon: BookOpen },
  { name: 'graduation-cap',   label: 'Educación',        Icon: GraduationCap },
  { name: 'pen-line',         label: 'Escritura',        Icon: PenLine },
  { name: 'library',          label: 'Biblioteca',       Icon: Library },
  { name: 'notebook-pen',     label: 'Cuadernos',        Icon: NotebookPen },
  // ── Tecnología ─────────────────────────────
  { name: 'laptop',           label: 'Laptop',           Icon: Laptop },
  { name: 'monitor',          label: 'Monitor',          Icon: Monitor },
  { name: 'tablet',           label: 'Tablet',           Icon: Tablet },
  { name: 'smartphone',       label: 'Celular',          Icon: Smartphone },
  { name: 'printer',          label: 'Impresora',        Icon: Printer },
  { name: 'cpu',              label: 'Componentes',      Icon: Cpu },
  { name: 'hard-drive',       label: 'Almacenamiento',   Icon: HardDrive },
  { name: 'wifi',             label: 'Red / Wi-Fi',      Icon: Wifi },
  { name: 'plug',             label: 'Electricidad',     Icon: Plug },
  // ── Ciencia ────────────────────────────────
  { name: 'flask-conical',    label: 'Laboratorio',      Icon: FlaskConical },
  { name: 'microscope',       label: 'Microscopio',      Icon: Microscope },
  { name: 'test-tube',        label: 'Química',          Icon: TestTube },
  { name: 'atom',             label: 'Física',           Icon: Atom },
  // ── Arte ───────────────────────────────────
  { name: 'palette',          label: 'Arte',             Icon: Palette },
  { name: 'brush',            label: 'Pintura',          Icon: Brush },
  { name: 'pen-tool',         label: 'Diseño',           Icon: PenTool },
  { name: 'scissors',         label: 'Manualidades',     Icon: Scissors },
  // ── Música / AV ────────────────────────────
  { name: 'music2',           label: 'Música',           Icon: Music2 },
  { name: 'headphones',       label: 'Audio',            Icon: Headphones },
  { name: 'mic2',             label: 'Micrófono',        Icon: Mic2 },
  { name: 'radio',            label: 'Radio',            Icon: Radio },
  { name: 'camera',           label: 'Fotografía',       Icon: Camera },
  { name: 'video',            label: 'Video',            Icon: Video },
  { name: 'projector',        label: 'Proyector',        Icon: Projector },
  // ── Deportes ───────────────────────────────
  { name: 'dumbbell',         label: 'Deportes',         Icon: Dumbbell },
  { name: 'bike',             label: 'Ciclismo',         Icon: Bike },
  { name: 'trophy',           label: 'Logros',           Icon: Trophy },
  { name: 'target',           label: 'Tiro / Puntería',  Icon: Target },
  // ── Herramientas ───────────────────────────
  { name: 'wrench',           label: 'Herramientas',     Icon: Wrench },
  { name: 'hammer',           label: 'Taller',           Icon: Hammer },
  { name: 'drill',            label: 'Taladro',          Icon: Drill },
  { name: 'hard-hat',         label: 'Construcción',     Icon: HardHat },
  // ── Cocina ─────────────────────────────────
  { name: 'utensils-crossed', label: 'Cocina',           Icon: UtensilsCrossed },
  { name: 'chef-hat',         label: 'Chef',             Icon: ChefHat },
  { name: 'coffee',           label: 'Café / Bebidas',   Icon: Coffee },
  { name: 'wine',             label: 'Vinos',            Icon: Wine },
  { name: 'cup-soda',         label: 'Bebidas',          Icon: CupSoda },
  { name: 'apple',            label: 'Alimentos',        Icon: Apple },
  { name: 'shopping-basket',  label: 'Despensa',         Icon: ShoppingBasket },
  // ── Ropa / Moda ────────────────────────────
  { name: 'shirt',            label: 'Ropa',             Icon: Shirt },
  { name: 'shopping-bag',     label: 'Moda / Tienda',    Icon: ShoppingBag },
  { name: 'watch',            label: 'Accesorios',       Icon: Watch },
  { name: 'gem',              label: 'Joyería',          Icon: Gem },
  { name: 'crown',            label: 'Premium',          Icon: Crown },
  { name: 'tag',              label: 'Etiquetas',        Icon: Tag },
  // ── Hogar ──────────────────────────────────
  { name: 'home',             label: 'Hogar',            Icon: Home },
  { name: 'sofa',             label: 'Sala',             Icon: Sofa },
  { name: 'armchair',         label: 'Sillón',           Icon: Armchair },
  { name: 'bed',              label: 'Dormitorio',       Icon: Bed },
  { name: 'bath',             label: 'Baño',             Icon: Bath },
  { name: 'lamp',             label: 'Iluminación',      Icon: Lamp },
  { name: 'tv',               label: 'Televisión',       Icon: Tv },
  { name: 'door-open',        label: 'Acceso',           Icon: DoorOpen },
  // ── Salud / Médico ─────────────────────────
  { name: 'heart',            label: 'Salud',            Icon: Heart },
  { name: 'stethoscope',      label: 'Médico',           Icon: Stethoscope },
  { name: 'pill',             label: 'Medicamentos',     Icon: Pill },
  { name: 'syringe',          label: 'Enfermería',       Icon: Syringe },
  { name: 'thermometer',      label: 'Temperatura',      Icon: Thermometer },
  { name: 'cross',            label: 'Primeros Auxilios',Icon: Cross },
  // ── Transporte ─────────────────────────────
  { name: 'car',              label: 'Vehículos',        Icon: Car },
  { name: 'truck',            label: 'Transporte pesado',Icon: Truck },
  { name: 'bus',              label: 'Bus',              Icon: Bus },
  { name: 'plane',            label: 'Aviación',         Icon: Plane },
  { name: 'ship',             label: 'Náutico',          Icon: Ship },
  { name: 'fuel',             label: 'Combustible',      Icon: Fuel },
  // ── Jardín / Naturaleza ────────────────────
  { name: 'flower2',          label: 'Jardín',           Icon: Flower2 },
  { name: 'trees',            label: 'Plantas',          Icon: Trees },
  { name: 'leaf',             label: 'Naturaleza',       Icon: Leaf },
  { name: 'sun',              label: 'Exterior',         Icon: Sun },
  { name: 'snowflake',        label: 'Frío / Clima',     Icon: Snowflake },
  { name: 'cloud',            label: 'Clima',            Icon: Cloud },
  // ── Mascotas / Bebés ───────────────────────
  { name: 'paw-print',        label: 'Mascotas',         Icon: PawPrint },
  { name: 'baby',             label: 'Bebés / Niños',    Icon: Baby },
  // ── Ocio ───────────────────────────────────
  { name: 'gamepad2',         label: 'Juegos',           Icon: Gamepad2 },
  { name: 'gift',             label: 'Regalos',          Icon: Gift },
  { name: 'star',             label: 'Destacado',        Icon: Star },
  // ── Oficina / General ──────────────────────
  { name: 'briefcase',        label: 'Oficina',          Icon: Briefcase },
  { name: 'folder',           label: 'Archivos',         Icon: Folder },
  { name: 'file-text',        label: 'Documentos',       Icon: FileText },
  { name: 'clipboard-list',   label: 'Inventario',       Icon: ClipboardList },
  { name: 'package',          label: 'Paquetes',         Icon: Package },
  { name: 'archive',          label: 'Almacén',          Icon: Archive },
  { name: 'layers',           label: 'Categoría',        Icon: Layers },
  // ── Espacios / Seguridad ───────────────────
  { name: 'building2',        label: 'Infraestructura',  Icon: Building2 },
  { name: 'globe',            label: 'General',          Icon: Globe },
  { name: 'shield',           label: 'Seguridad',        Icon: Shield },
  { name: 'lock',             label: 'Acceso restringido',Icon: Lock },
  { name: 'zap',              label: 'Energía',          Icon: Zap },
  { name: 'recycle',          label: 'Reciclaje',        Icon: Recycle },
] as const;

export type CategoryIconName = typeof CATEGORY_ICON_LIST[number]['name'];

const iconMap = Object.fromEntries(CATEGORY_ICON_LIST.map((i) => [i.name, i.Icon]));

export function getCategoryIconComponent(iconName?: string | null) {
  if (iconName && iconMap[iconName]) return iconMap[iconName];
  return Package;
}
