import { useState, useEffect } from 'react';
import { useTenants } from '../hooks/useTenants';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface SuperAdminTenant {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

export function TenantSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const { tenants, currentTenant, loading, switchTenant } = useTenants();
  const { user } = useAuth();

  // States for SUPERADMIN mode
  const [allTenants, setAllTenants] = useState<SuperAdminTenant[]>([]);
  const [selectedSuperAdminTenant, setSelectedSuperAdminTenant] = useState<string>('');
  const [loadingSuperAdmin, setLoadingSuperAdmin] = useState(false);

  const isSuperAdmin = user?.role === 'SUPERADMIN';

  // Load all tenants for SUPERADMIN
  useEffect(() => {
    if (isSuperAdmin) {
      loadAllTenants();
    }
  }, [isSuperAdmin]);

  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    return fetch(url, {
      ...options,
      headers,
    });
  };

  const loadAllTenants = async () => {
    try {
      setLoadingSuperAdmin(true);
      // Buscar apenas tenants associados ao usuário (mesmo para SUPERADMIN)
      const response = await authenticatedFetch('/api/user-tenants');
      if (response.ok) {
        const data = await response.json();
        const tenantsArray = data.tenants || [];
        setAllTenants(tenantsArray);

        // Load from localStorage or select first
        const savedTenantId = localStorage.getItem('superadmin_selected_tenant');
        if (savedTenantId && tenantsArray.some((t: SuperAdminTenant) => t.id === savedTenantId)) {
          setSelectedSuperAdminTenant(savedTenantId);
        } else if (tenantsArray.length > 0) {
          setSelectedSuperAdminTenant(tenantsArray[0].id);
          localStorage.setItem('superadmin_selected_tenant', tenantsArray[0].id);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
      toast.error('Erro ao carregar empresas');
    } finally {
      setLoadingSuperAdmin(false);
    }
  };

  const handleSuperAdminTenantSwitch = async (tenantId: string) => {
    try {
      setIsOpen(false);
      setLoadingSuperAdmin(true);

      const token = localStorage.getItem('auth_token');
      const response = await authenticatedFetch('/api/user-tenants/switch', {
        method: 'POST',
        body: JSON.stringify({ tenantId })
      });

      if (!response.ok) {
        throw new Error('Erro ao trocar empresa');
      }

      const data = await response.json();
      if (data.success) {
        // Update token with new tenant context
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('superadmin_selected_tenant', tenantId);

        toast.success('Empresa alterada com sucesso');

        // Reload page to refresh all tenant-specific data
        window.location.reload();
      }
    } catch (error) {
      console.error('Erro ao trocar empresa:', error);
      toast.error('Erro ao trocar empresa');
      setLoadingSuperAdmin(false);
    }
  };

  // SUPERADMIN mode
  if (isSuperAdmin) {
    if (allTenants.length === 0 && !loadingSuperAdmin) {
      return null;
    }

    const selectedTenant = allTenants.find(t => t.id === selectedSuperAdminTenant);

    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 transition-colors"
          disabled={loadingSuperAdmin}
        >
          <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v-3a1 1 0 011-1h2a1 1 0 011 1v3" />
          </svg>
          <span className="text-sm text-blue-700 font-medium max-w-[150px] truncate">
            {selectedTenant?.name || 'Selecionar empresa'}
          </span>
          <svg className={`h-4 w-4 text-blue-600 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-10 bg-black/5" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
              <div className="py-1">
                <div className="px-3 py-2 text-xs font-medium text-blue-600 uppercase tracking-wider border-b border-gray-100">
                  🔧 Modo Super Admin
                </div>
                {allTenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => handleSuperAdminTenantSwitch(tenant.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      tenant.id === selectedSuperAdminTenant ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{tenant.name}</div>
                        <div className="text-xs text-gray-500">{tenant.slug}</div>
                      </div>
                      {tenant.id === selectedSuperAdminTenant && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Regular user mode
  if (!tenants || tenants.length <= 1) {
    return null;
  }

  const handleTenantSwitch = async (tenantId: string) => {
    setIsOpen(false);
    await switchTenant(tenantId);
  };

  return (
    <div className="relative">
      {/* Tenant Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        disabled={loading}
      >
        {/* Building icon */}
        <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v-3a1 1 0 011-1h2a1 1 0 011 1v3" />
        </svg>
        <span className="text-sm text-gray-700 max-w-[150px] truncate">
          {currentTenant?.name || 'Selecionar empresa'}
        </span>
        {/* Chevron down icon */}
        <svg className={`h-4 w-4 text-gray-500 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-10 bg-black/5"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="py-1">
              <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                Empresas Disponíveis
              </div>

              {tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handleTenantSwitch(tenant.id)}
                  disabled={loading || tenant.current}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                    tenant.current ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div>
                    <div className="font-medium">{tenant.name}</div>
                    <div className="text-xs text-gray-500">
                      {tenant.role === 'SUPERADMIN' ? 'Super Admin' : tenant.role}
                    </div>
                  </div>

                  {tenant.current && (
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}