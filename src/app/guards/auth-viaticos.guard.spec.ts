import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthViaticosGuard } from './auth-viaticos.guard';
import { UserStateService } from '../services/user-state.service';

describe('AuthViaticosGuard', () => {
  let guard: AuthViaticosGuard;
  let userState: jasmine.SpyObj<UserStateService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    userState = jasmine.createSpyObj('UserStateService', [
      'isAuthenticated', 'isAdmin', 'isSuperAdmin', 'isCoordinador', 'canApproveL1', 'getRole',
    ]);
    router = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        AuthViaticosGuard,
        { provide: UserStateService, useValue: userState },
        { provide: Router, useValue: router },
      ],
    });
    guard = TestBed.inject(AuthViaticosGuard);
  });

  it('returns false and navigates to /login when not authenticated', () => {
    userState.isAuthenticated.and.returnValue(false);
    expect(guard.canActivate()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('returns true when admin', () => {
    userState.isAuthenticated.and.returnValue(true);
    userState.isAdmin.and.returnValue(true);
    userState.isSuperAdmin.and.returnValue(false);
    userState.isCoordinador.and.returnValue(false);
    userState.canApproveL1.and.returnValue(false);
    expect(guard.canActivate()).toBeTrue();
  });

  it('returns true when superadmin', () => {
    userState.isAuthenticated.and.returnValue(true);
    userState.isAdmin.and.returnValue(false);
    userState.isSuperAdmin.and.returnValue(true);
    userState.isCoordinador.and.returnValue(false);
    userState.canApproveL1.and.returnValue(false);
    expect(guard.canActivate()).toBeTrue();
  });

  it('returns true when coordinador', () => {
    userState.isAuthenticated.and.returnValue(true);
    userState.isAdmin.and.returnValue(false);
    userState.isSuperAdmin.and.returnValue(false);
    userState.isCoordinador.and.returnValue(true);
    userState.canApproveL1.and.returnValue(false);
    expect(guard.canActivate()).toBeTrue();
  });

  it('returns true when canApproveL1', () => {
    userState.isAuthenticated.and.returnValue(true);
    userState.isAdmin.and.returnValue(false);
    userState.isSuperAdmin.and.returnValue(false);
    userState.isCoordinador.and.returnValue(false);
    userState.canApproveL1.and.returnValue(true);
    expect(guard.canActivate()).toBeTrue();
  });

  it('redirects Colaborador without permission to /mis-rendiciones', () => {
    userState.isAuthenticated.and.returnValue(true);
    userState.isAdmin.and.returnValue(false);
    userState.isSuperAdmin.and.returnValue(false);
    userState.isCoordinador.and.returnValue(false);
    userState.canApproveL1.and.returnValue(false);
    userState.getRole.and.returnValue('Colaborador');
    expect(guard.canActivate()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/mis-rendiciones']);
  });

  it('redirects Contabilidad to /tesoreria', () => {
    userState.isAuthenticated.and.returnValue(true);
    userState.isAdmin.and.returnValue(false);
    userState.isSuperAdmin.and.returnValue(false);
    userState.isCoordinador.and.returnValue(false);
    userState.canApproveL1.and.returnValue(false);
    userState.getRole.and.returnValue('Contabilidad');
    expect(guard.canActivate()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/tesoreria']);
  });
});
