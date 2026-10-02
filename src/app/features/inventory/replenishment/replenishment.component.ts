import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
@Component({
 selector: 'app-replenishment', standalone: true,
 imports: [RouterLink, TranslateModule, ButtonModule],
 templateUrl: './replenishment.component.html',
 styleUrl: './replenishment.component.scss',
})
export class ReplenishmentComponent {}
