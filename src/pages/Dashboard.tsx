import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { AdminDashboard } from './AdminDashboard';
import { EditoraDashboard } from './EditoraDashboard';

export function Dashboard() {
  const { isPublisher } = usePermissions();

  if (isPublisher) {
    return <EditoraDashboard />;
  }

  return <AdminDashboard />;
}
