import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Table, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import * as QRCode from 'qrcode';
import { InventoryItem } from '../../../core/models/inventory.model';
import { CatalogItemsService } from '../catalog-items.service';
import { PageShellComponent, PageHeaderComponent, FiltersBarComponent, SectionCardComponent } from '../../../shared/ui';

@Component({
  selector: 'app-catalog-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ButtonModule, InputTextModule, TagModule, SkeletonModule, DialogModule, TranslateModule, PageShellComponent, PageHeaderComponent, FiltersBarComponent, SectionCardComponent],
  templateUrl: './catalog-list.component.html',
  styleUrl: './catalog-list.component.scss',
})
export class CatalogListComponent implements OnInit {
  private catalogItems = inject(CatalogItemsService);
  private document = inject(DOCUMENT);
  private translate = inject(TranslateService);

  items = signal<InventoryItem[]>([]);
  loading = signal(true);
  totalRecords = signal(0);
  searchQuery = '';
  selectedItem = signal<InventoryItem | null>(null);
  qrImage = signal('');
  qrLoading = signal(false);
  qrError = signal(false);
  showQr = false;
  private qrRequest = 0;

  async generateQr(item: InventoryItem): Promise<void> {
    const request = ++this.qrRequest;
    this.selectedItem.set(item);
    this.qrImage.set('');
    this.qrError.set(false);
    this.qrLoading.set(true);
    this.showQr = true;
    try {
      const image = await QRCode.toDataURL(item.barcode || `tachyon-wms:item:${item.id}`, {
        errorCorrectionLevel: 'M', margin: 4, width: 512,
        color: { dark: '#000000', light: '#ffffff' },
      });
      if (request === this.qrRequest) this.qrImage.set(image);
    } catch {
      if (request === this.qrRequest) this.qrError.set(true);
    } finally {
      if (request === this.qrRequest) this.qrLoading.set(false);
    }
  }

  downloadQr(): void {
    const item = this.selectedItem();
    if (!item || !this.qrImage()) return;
    const bytes = Uint8Array.from(atob(this.qrImage().split(',')[1]), char => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    const link = this.document.createElement('a');
    link.href = url;
    link.download = `${item.sku.replace(/[^a-zA-Z0-9_.-]/g, '_')}-QR.png`;
    this.document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  printQr(): void {
    const item = this.selectedItem();
    if (!item || !this.qrImage()) return;
    const frame = this.document.createElement('iframe');
    frame.title = this.translate.instant('UI.PRINT_QR');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;';
    this.document.body.appendChild(frame);
    const printDocument = frame.contentDocument;
    const printWindow = frame.contentWindow;
    if (!printDocument || !printWindow) { frame.remove(); return; }
    printDocument.title = `${item.sku} QR`;
    const style = printDocument.createElement('style');
    style.textContent = '@page{margin:15mm}body{font-family:Arial,sans-serif;text-align:center;color:#000}img{width:65mm;height:65mm}h1{font-size:20pt}p{font-size:14pt}';
    printDocument.head.appendChild(style);
    const name = printDocument.createElement('h1');
    name.textContent = item.name;
    const sku = printDocument.createElement('p');
    sku.textContent = item.sku;
    sku.dir = 'ltr';
    const image = printDocument.createElement('img');
    image.alt = `${item.name} QR`;
    image.onload = () => {
      printWindow.addEventListener('afterprint', () => frame.remove(), { once: true });
      printWindow.focus();
      printWindow.print();
    };
    image.onerror = () => frame.remove();
    printDocument.body.append(name, sku, image);
    image.src = this.qrImage();
  }

  ngOnInit(): void { this.loadItems(); }

  loadItems(): void {
    this.loading.set(true);
    this.catalogItems.getCatalogItems({ page: 1 }).subscribe({
      next: (response) => {
        this.items.set(response.data);
        this.totalRecords.set(response.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  clearFilters(table: Table): void { this.searchQuery = ''; table.clear(); }

  getStatusSeverity(status: InventoryItem['status']): 'success' | 'secondary' {
    return status === 'active' ? 'success' : 'secondary';
  }
}
