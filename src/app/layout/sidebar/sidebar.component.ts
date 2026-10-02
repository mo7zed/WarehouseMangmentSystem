import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PanelMenuModule } from 'primeng/panelmenu';
import { TooltipModule } from 'primeng/tooltip';
import { LayoutService } from '../../core/services/layout.service';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  badge?: string | number;
  children?: { id: string; label: string; route: string; icon: string }[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslateModule, PanelMenuModule, TooltipModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnInit {
  private layout = inject(LayoutService);
  private translate = inject(TranslateService);
  isRTL = () => this.translate.currentLang === 'ar';
  closeMobileMenu(): void { this.layout.closeMobileMenu(); }

  isCollapsed = this.layout.sidebarCollapsed;
  mobileMenuOpen = this.layout.mobileMenuOpen;
  private expandedItems = signal<Set<string>>(new Set());

  navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'NAV.DASHBOARD',
      icon: 'pi-th-large',
      route: '/dashboard',
    },
    {
      id: 'inventory',
      label: 'NAV.INVENTORY',
      icon: 'pi-box',
      route: '/inventory',
      children: [
        { id: 'stock', label: 'NAV.STOCK_OVERVIEW', route: '/inventory/stock', icon: '' },
        { id: 'items', label: 'NAV.ITEM_MASTER', route: '/inventory/items', icon: '' },
        { id: 'bins', label: 'NAV.BIN_MANAGEMENT', route: '/inventory/bins', icon: '' },
        { id: 'cycle', label: 'NAV.CYCLE_COUNTING', route: '/inventory/cycle-counts', icon: '' },
        { id: 'repl', label: 'NAV.REPLENISHMENT', route: '/inventory/replenishment', icon: '' },
      ]
    },
    {
      id: 'receiving',
      label: 'NAV.RECEIVING',
      icon: 'pi-download',
      route: '/receiving',
    },
    {
      id: 'orders',
      label: 'NAV.ORDERS',
      icon: 'pi-shopping-cart',
      route: '/orders',
    },
    {
      id: 'shipping',
      label: 'NAV.SHIPPING',
      icon: 'pi-send',
      route: '/shipping',
    },
    {
      id: 'returns',
      label: 'NAV.RETURNS',
      icon: 'pi-replay',
      route: '/returns',
    },
    {
      id: 'reports',
      label: 'NAV.REPORTS',
      icon: 'pi-chart-bar',
      route: '/reports',
    },
    {
      id: 'labor',
      label: 'NAV.LABOR',
      icon: 'pi-users',
      route: '/labor',
    },
  ];

  ngOnInit(): void {
    // Auto-expand active module
    this.expandedItems.update(s => {
      const set = new Set(s);
      set.add('inventory');
      return set;
    });
  }

  toggleSidebar(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      this.layout.closeMobileMenu();
      return;
    }
    this.layout.toggleSidebar();
  }

  isItemExpanded(id: string): boolean {
    return this.expandedItems().has(id);
  }

  toggleItem(id: string): void {
    this.expandedItems.update(s => {
      const set = new Set(s);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return set;
    });
  }
}
