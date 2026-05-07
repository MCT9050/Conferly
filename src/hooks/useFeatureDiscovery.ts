/**
 * Feature Discovery System
 * Provides in-app tutorial and guided walkthroughs for new users.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/** Feature steps for onboarding and feature discovery */
export interface FeatureStep {
  id: string;
  target: string; // CSS selector or element ID
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export interface DiscoveryConfig {
  featureId: string;
  steps: FeatureStep[];
  completedAt?: string;
}

/** Default feature discovery configurations */
export const FEATURE_GUIDES: Record<string, DiscoveryConfig> = {
  onboarding: {
    featureId: 'onboarding',
    steps: [
      {
        id: 'welcome',
        target: '[data-tour="welcome"]',
        title: 'Welcome to Conferly',
        content: 'Your all-in-one video conferencing platform. Let\'s get you set up!',
        position: 'bottom'
      },
      {
        id: 'create-meeting',
        target: '[data-tour="create-meeting"]',
        title: 'Create a Meeting',
        content: 'Click here to start a new meeting. Share the link with participants!',
        position: 'bottom'
      },
      {
        id: 'join-meeting',
        target: '[data-tour="join-meeting"]',
        title: 'Join a Meeting',
        content: 'Enter a meeting code to join an existing meeting.',
        position: 'bottom'
      },
      {
        id: 'profile',
        target: '[data-tour="profile"]',
        title: 'Your Profile',
        content: 'Manage your account, subscription, and preferences here.',
        position: 'left'
      }
    ]
  },
  meeting: {
    featureId: 'meeting',
    steps: [
      {
        id: 'controls',
        target: '[data-tour="meeting-controls"]',
        title: 'Meeting Controls',
        content: 'Mute, camera, share screen, and more.',
        position: 'top'
      },
      {
        id: 'chat',
        target: '[data-tour="meeting-chat"]',
        title: 'In-Meeting Chat',
        content: 'Chat with other participants during the meeting.',
        position: 'left'
      },
      {
        id: 'notes',
        target: '[data-tour="meeting-notes"]',
        title: 'Shared Notes',
        content: 'Collaborate on notes in real-time with all participants.',
        position: 'right'
      }
    ]
  },
  subscription: {
    featureId: 'subscription',
    steps: [
      {
        id: 'upgrade',
        target: '[data-tour="upgrade"]',
        title: 'Upgrade Plan',
        content: 'Unlock premium features with a paid subscription.',
        position: 'bottom'
      }
    ]
  }
};

/**
 * Hook for feature discovery and onboarding walkthroughs
 * @param featureId - The feature guide to use (e.g., 'onboarding', 'meeting')
 * @param onComplete - Callback when walkthrough is completed
 */
export function useFeatureDiscovery(
  featureId: string,
  onComplete?: () => void
) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const configRef = useRef(FEATURE_GUIDES[featureId]);
  
  // Load completion state from localStorage
  useEffect(() => {
    const completed = localStorage.getItem(`discovery_${featureId}_completed`);
    if (completed) {
      setHasCompleted(true);
    }
  }, [featureId]);
  
  const steps = configRef.current?.steps || [];
  
  const show = useCallback(() => {
    if (!hasCompleted) {
      setIsVisible(true);
      setCurrentStep(0);
    }
  }, [hasCompleted]);
  
  const next = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      complete();
    }
  }, [currentStep, steps.length]);
  
  const prev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);
  
  const skip = useCallback(() => {
    complete();
  }, []);
  
  const complete = useCallback(() => {
    setIsVisible(false);
    setHasCompleted(true);
    localStorage.setItem(`discovery_${featureId}_completed`, new Date().toISOString());
    onComplete?.();
  }, [featureId, onComplete]);
  
  const reset = useCallback(() => {
    localStorage.removeItem(`discovery_${featureId}_completed`);
    setHasCompleted(false);
    setCurrentStep(0);
  }, [featureId]);
  
  return {
    isVisible,
    hasCompleted,
    currentStep,
    step: steps[currentStep],
    totalSteps: steps.length,
    show,
    next,
    prev,
    skip,
    complete,
    reset
  };
}

/**
 * Hook for showing feature tooltips
 * @param tooltipId - Unique identifier for the tooltip
 */
export function useTooltip(tooltipId: string) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasSeen, setHasSeen] = useState(() => {
    return localStorage.getItem(`tooltip_${tooltipId}_seen`) === 'true';
  });
  
  const dismiss = useCallback(() => {
    setIsVisible(false);
    if (!hasSeen) {
      localStorage.setItem(`tooltip_${tooltipId}_seen`, 'true');
      setHasSeen(true);
    }
  }, [tooltipId, hasSeen]);
  
  const show = useCallback(() => {
    if (!hasSeen) {
      setIsVisible(true);
    }
  }, [hasSeen]);
  
  return { isVisible, hasSeen, show, dismiss };
}
