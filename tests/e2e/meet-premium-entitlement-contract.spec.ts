import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function readProjectFile(...segments: string[]) {
  return readFile(path.join(process.cwd(), ...segments), 'utf8');
}

test.describe('Meet premium feature entitlement contract', () => {
  test('Meet premium capabilities are centralized and product-scoped to Meet', async () => {
    const meetEntitlements = await readProjectFile('lib', 'meetEntitlements.ts');

    expect(meetEntitlements).toContain('export async function canUseMeetFeature');
    expect(meetEntitlements).toContain('feature: MeetFeature');
    expect(meetEntitlements).toContain('verifyRoomAccess(userId, normalizedRoomId)');
    expect(meetEntitlements).toContain(".eq('product_line', 'meet')");
    expect(meetEntitlements).not.toContain(".eq('product_line', 'class')");
    expect(meetEntitlements).toContain("'meet_individual'");
    expect(meetEntitlements).toContain("'meet_pro'");
    expect(meetEntitlements).not.toContain("'class_10'");
  });

  test('AI server actions fail closed without Meet room context', async () => {
    const aiActions = await readProjectFile('app', 'actions', 'ai-actions.ts');

    expect(aiActions).toContain('if (meetFeature)');
    expect(aiActions).toContain('canUseMeetFeature(session.userId, roomId, meetFeature)');
    expect(aiActions).toContain("error: 'Meet room context required'");
    expect(aiActions).toContain("error: 'Meet premium entitlement required'");
    expect(aiActions).toContain("'ai_summary'");
    expect(aiActions).toContain("'ai_assistant'");
  });

  test('Meet UI supplies room context for premium AI actions', async () => {
    const meetSession = await readProjectFile('components', 'meet', 'MeetLiveSession.tsx');

    expect(meetSession).toContain('assistantAction(fullPrompt, roomId)');
    expect(meetSession).toContain('summarizeAction(fullText, roomId)');
    expect(meetSession).toContain('roomId={roomId}');
  });
});