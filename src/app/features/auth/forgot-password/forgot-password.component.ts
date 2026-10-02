import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';

@Component({
 selector: 'app-forgot-password', standalone: true,
 imports: [RouterLink, TranslateModule, ButtonModule],
 templateUrl: './forgot-password.component.html',
 styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {}
