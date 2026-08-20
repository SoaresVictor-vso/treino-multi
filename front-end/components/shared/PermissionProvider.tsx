'use client';

import { createContext, useContext } from 'react';

const PermissionContext = createContext({
	canCreateExercise: false,
	isGlobal: false,
});

export function PermissionProvider({
	children,
	canCreateExercise,
	isGlobal,
}: {
	children: React.ReactNode;
	canCreateExercise: boolean;
	isGlobal: boolean;
}) {
	return (
		<PermissionContext.Provider value={{ canCreateExercise, isGlobal }}>
			{children}
		</PermissionContext.Provider>
	);
}

export function usePermissions() {
	return useContext(PermissionContext);
}
