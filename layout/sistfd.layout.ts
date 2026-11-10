import { 
  ChangeDetectionStrategy, 
  Component, 
  ElementRef, 
  inject, 
  viewChild, 
  DestroyRef, 
  computed, 
  OnInit, 
  OnDestroy 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// Angular Material
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

// Modais (Dialogs)
import { UserCreateComponent } from '../components/users/user-create/user-create.component';
import { RoleCreateComponent } from '../components/roles/role-create/role-create.component';

// Enums Locais e Serviços
import { Professionals } from '../enums/professionals';
import { SistfdUser } from '../models/user.model';
import { AuthService } from '../services/auth.service';

// Nomes dos canais do módulo SISTFD
type SistfdChannelKey = 'ROLES' | 'USERS' | 'COST_ASSISTANCES' | 'ACCOUNTABILITIES';

const SISTFD_CHANNEL_NAMES: Record<SistfdChannelKey, string> = {
  ROLES: 'sistfd-roles-channel',
  USERS: 'sistfd-users-channel',
  COST_ASSISTANCES: 'sistfd-cost-assistances-channel',
  ACCOUNTABILITIES: 'sistfd-accountabilities-channel',
};

interface MenuItem {
  label: string;
  icon: string;
  types?: string[];        // Tipos de profissional autorizados (opcional)
  permissions?: string[];  // Permissões de acesso autorizadas (opcional)
  routerLink?: string[];
  action?: () => void;
}

interface MenuGroup {
  subHeader: string;
  requiredTypes?: string[];       // Tipos exigidos para o grupo
  requiredPermissions?: string[]; // Permissões exigidas para o grupo
  items: MenuItem[];
}

@Component({
  selector: 'app-sistfd-layout',
  standalone: true,
  imports: [
    CommonModule, 
    MatSidenavModule, 
    MatListModule, 
    MatIconModule, 
    RouterModule, 
    MatMenuModule,
    MatDialogModule
  ],
  templateUrl: './sistfd.layout.html',
  styleUrl: './sistfd.layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SistfdLayout implements OnInit, OnDestroy {
  // 🔒 Injeções de dependência
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  // Captura do input HTML
  protected readonly competence = viewChild.required<ElementRef>('competence');
  
  // 📡 Mapa de instâncias dos BroadcastChannels do SISTFD
  private readonly channels = new Map<SistfdChannelKey, BroadcastChannel>();

  // ==========================================
  // REATIVIDADE VIA SIGNALS
  // ==========================================

  /**
   * Reage dinamicamente a alterações no usuário logado dentro do AuthService
   */
  protected readonly currentUser = computed(() => this.authService.currentUser() as SistfdUser | null);

  /**
   * Extrai a lista de tipos de profissional atrelados ao usuário de forma resiliente
   */
  protected readonly userProfessionalTypes = computed<string[]>(() => {
    const user = this.currentUser();
    const professional = user?.professional;

    if (!professional) return [];

    const rawTypes = (professional as any)?.types || (professional as any)?.type || [];
    const typesList = Array.isArray(rawTypes) ? rawTypes : [rawTypes];

    return typesList
      .map((item: any) => {
        if (typeof item === 'string') return item;
        return item?.type || item?.name || item?.description || '';
      })
      .filter((type): type is string => Boolean(type))
      .map((type) => type.trim());
  });

  // ==========================================
  // Ciclo de Vida (Inicialização e Finalização dos Canais)
  // ==========================================

  ngOnInit(): void {
    (Object.keys(SISTFD_CHANNEL_NAMES) as SistfdChannelKey[]).forEach(key => {
      this.channels.set(key, new BroadcastChannel(SISTFD_CHANNEL_NAMES[key]));
    });
  }

  ngOnDestroy(): void {
    this.channels.forEach(channel => channel.close());
    this.channels.clear();
  }

  /**
   * Método auxiliar para emitir mensagens com segurança no canal especificado
   */
  public postMessage(channelKey: SistfdChannelKey, message: any = 'update'): void {
    const channel = this.channels.get(channelKey);
    if (channel) {
      channel.postMessage(message);
    }
  }

  // ==========================================
  // Métodos de Verificação de Acesso (Reativos)
  // ==========================================

  /**
   * Verifica se o usuário possui ao menos um dos tipos de profissional informados.
   */
  protected checkProfessionalType(allowedTypes?: string[]): boolean {
    if (!allowedTypes || allowedTypes.length === 0) return true;

    const currentTypes = this.userProfessionalTypes();
    return allowedTypes.some(type => 
      currentTypes.some(uType => uType.toLowerCase() === type.toLowerCase())
    );
  }

  /**
   * Verifica se o usuário possui ao menos uma das permissões informadas.
   */
  protected checkPermission(names?: string[]): boolean {
    if (!names || names.length === 0) return true;

    const user = this.currentUser();
    const roles: any[] = user?.roles || [];

    if (!roles.length) return false;

    const module = this.route.snapshot.routeConfig?.path || this.route.parent?.snapshot.routeConfig?.path || '';

    const userPermissions = roles.flatMap((role: any) => 
      (role.permissions || []).map((p: any) => p.name?.trim())
    );

    return names.some(name => {
      const fullPermissionName = module ? `${module}/${name}` : name;
      return userPermissions.includes(fullPermissionName) || userPermissions.includes(name);
    });
  }

  /**
   * Combina a verificação de Tipo de Profissional E Permissões.
   */
  protected hasAccess(types?: string[], permissions?: string[]): boolean {
    return this.checkProfessionalType(types) && this.checkPermission(permissions);
  }

  private openDialog(component: any, width = '500px', height = 'auto', channelKey?: SistfdChannelKey): void {
    this.dialog.open(component, {
      width,
      height,
      disableClose: true,
      autoFocus: false,
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result && channelKey) {
          this.postMessage(channelKey, 'update');
        }
      });
  }

  // ==========================================
  // MENU DO TEMPLATE HTML
  // ==========================================
  protected readonly menuGroups: MenuGroup[] = [
    {
      subHeader: 'Usuários',
      requiredTypes: [Professionals.ADMINISTRADOR],
      requiredPermissions: ['usuário listar', 'usuário criar'],
      items: [
        { 
          label: 'Usuários', 
          icon: 'groups', 
          types: [Professionals.ADMINISTRADOR], 
          permissions: ['usuário listar'], 
          routerLink: ['usuarios'] 
        },
        { 
          label: 'Novo usuário', 
          icon: 'person_add', 
          types: [Professionals.ADMINISTRADOR], 
          permissions: ['usuário criar'], 
          action: () => this.userCreate() 
        }
      ]
    },
    {
      subHeader: 'Regras',
      requiredTypes: [Professionals.ADMINISTRADOR],
      requiredPermissions: ['regra listar', 'regra criar'],
      items: [
        { 
          label: 'Regras', 
          icon: 'security', 
          types: [Professionals.ADMINISTRADOR], 
          permissions: ['regra listar'], 
          routerLink: ['regras'] 
        },
        { 
          label: 'Nova regra', 
          icon: 'add_moderator', 
          types: [Professionals.ADMINISTRADOR], 
          permissions: ['regra criar'], 
          action: () => this.roleCreate() 
        }
      ]
    },
    {
      subHeader: 'Ajuda de custo',
      requiredTypes: [Professionals.AJUDA_DE_CUSTO],
      requiredPermissions: ['ajuda de custo listar'],
      items: [
        { 
          label: 'Ajuda de custo', 
          icon: 'price_check', 
          types: [Professionals.AJUDA_DE_CUSTO], 
          permissions: ['ajuda de custo listar'], 
          routerLink: ['ajudas-de-custo'] 
        },
      ]
    },
    {
      subHeader: 'Prestações de conta',
      requiredTypes: [Professionals.PRESTACAO_DE_CONTA],
      requiredPermissions: ['prestacao de conta listar'],
      items: [
        { 
          label: 'Prestação de contas', 
          icon: 'receipt_long', 
          types: [Professionals.PRESTACAO_DE_CONTA], 
          permissions: ['prestacao de conta listar'], 
          routerLink: ['prestacao-de-contas'] 
        },
      ]
    },
  ];

  // --- MÉTODOS DE AÇÃO DO TEMPLATE HTML ---
  protected userCreate(): void {
    this.openDialog(UserCreateComponent, '700px', 'auto', 'USERS');
  }

  protected roleCreate(): void {
    this.openDialog(RoleCreateComponent, '900px', 'auto', 'ROLES');
  }

}