import { env } from '../env.js';

/**
 * KeeperHub MCP integration — guaranteed onchain execution + audit trail.
 *
 * Three real workflows are deployed in our KeeperHub org and live at
 * https://app.keeperhub.com (workflow IDs below). Each one is fired by the
 * server at the appropriate lifecycle moment.
 *
 *   1. billing settlement verifier  — post-settle, reads getRevenue on Sepolia
 *      to assert the on-chain side actually accrued. (workflow type: read)
 *   2. INFT transfer verifier       — post-iTransfer, reads ownerOf on 0G
 *      Galileo to assert the new owner is set. Closes the multi-step ERC-7857
 *      flow with an attestation step.
 *   3. Discord deploy lifecycle     — fires on deploy.start / deploy.end with
 *      the full provision/teardown audit payload.
 *
 * Each fire creates a real KeeperHub execution. We surface the executionId in
 * our local audit log so the on-chain action and the Keeper run can be
 * cross-referenced from either side.
 */

export const KH_WORKFLOWS = {
  billingSettle: '9ucfocpbig3urovmnq6v9',
  inftTransfer: 'pgkehp9z83o3yeinkh8r2',
  discordDeploy: '49amr3waaqxy9vlw4wznn',
} as const;

export type KhWorkflowKey = keyof typeof KH_WORKFLOWS;

export interface KhFireResult {
  ok: boolean;
  workflowId: string;
  workflowKey: KhWorkflowKey;
  executionId?: string;
  status?: string;
  error?: string;
}

/**
 * Fire a KeeperHub workflow webhook. Best-effort — always resolves, never
 * throws. If KEEPERHUB_WEBHOOK_BASE is unset or the call fails the function
 * returns ok=false with an error reason; the caller should still proceed and
 * include the workflowId in its audit log so the run can be located later.
 *
 * The webhook base URL is the org-scoped endpoint that fronts the configured
 * trigger of each workflow. The webhook trigger output exposes the request
 * body to downstream nodes via `{{@trigger:Webhook.body.<field>}}`, so server
 * payloads must match the shapes used in workflow node configs:
 *
 *   billingSettle  -> { sessionId, tokenId, txHash, expectedUsd, durationSeconds, ensFullName }
 *   inftTransfer   -> { tokenId, newOwner, txHash, newStorageRoot, ensLabel }
 *   discordDeploy  -> { event, deployId, ensFullName, sessionId, guildId, channelId,
 *                       voiceId, ratePerMinUsd, ownerAddress, deployedSeconds?, expectedUsd? }
 */
export async function fireKeeperhubWorkflow(
  key: KhWorkflowKey,
  payload: Record<string, unknown>
): Promise<KhFireResult> {
  const workflowId = KH_WORKFLOWS[key];
  const base = process.env.KEEPERHUB_WEBHOOK_BASE;
  if (!base) {
    return {
      ok: false,
      workflowId,
      workflowKey: key,
      error: 'KEEPERHUB_WEBHOOK_BASE not set; logging workflow id only',
    };
  }
  // KeeperHub webhook URLs are org/workflow scoped. Verified shape:
  //   https://app.keeperhub.com/api/workflows/{id}/webhook
  // We accept either a base that already contains `{id}` as a placeholder
  // or appends the id to the path.
  const url = base.includes('{id}')
    ? base.replace('{id}', workflowId)
    : `${base.replace(/\/$/, '')}/${workflowId}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.KEEPERHUB_API_KEY
          ? { Authorization: `Bearer ${process.env.KEEPERHUB_API_KEY}` }
          : {}),
      },
      body: JSON.stringify(payload),
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // ignore — some webhooks return empty body
    }
    if (!res.ok) {
      return {
        ok: false,
        workflowId,
        workflowKey: key,
        error: `webhook ${res.status}`,
        status: data?.status,
      };
    }
    return {
      ok: true,
      workflowId,
      workflowKey: key,
      executionId: data?.executionId ?? data?.id,
      status: data?.status ?? 'fired',
    };
  } catch (e) {
    return {
      ok: false,
      workflowId,
      workflowKey: key,
      error: (e as Error).message,
    };
  }
}

// silence unused-var lint if env hasn't introduced a KH-specific schema field yet
void env;
