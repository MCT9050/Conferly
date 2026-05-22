export type UserProfile = {
  displayName: string;
  email: string;
  createdAt: string;
  avatarUrl?: string;
};

export type OnboardingData = {
  userType: 'individual' | 'organization';
  organizationName?: string;
  organizationSize?: number;
  organizationIndustry?: string;
};
