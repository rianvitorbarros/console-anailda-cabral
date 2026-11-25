import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

export function usePermissions() {
  const { panelUser } = useAuth();

  const role: UserRole = panelUser?.role || 'viewer';
  const isAdmin = role === 'admin';
  const isPublisher = role === 'publisher_operator';
  const isViewer = role === 'viewer';

  return {
    role,
    isAdmin,
    isPublisher,
    isViewer,
    
    // Feature permissions
    canManageUsers: isAdmin,
    canAccessMercadoPago: isAdmin,
    canEditProducts: isAdmin,
    canViewMetrics: isAdmin,
    canUpdateShipping: isAdmin || isPublisher,
    canReceivePushNotifications: isAdmin || isPublisher,
    canAccessSettings: isAdmin,
  };
}
