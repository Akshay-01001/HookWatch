import { prisma } from "@hook-watch/database";
import type { RetryDeliveryPayload } from "@hook-watch/queue";

/**
 * Handle a retry-delivery job.
 *
 * Loads the webhook event from the database, attempts delivery,
 * and records the result as a DeliveryAttempt.
 *
 * TODO: Implement actual HTTP delivery to the endpoint URL.
 * TODO: Add timeout handling and response body capture.
 * TODO: Update event status based on delivery outcome.
 */
export async function handleRetryDelivery(
  payload: RetryDeliveryPayload,
): Promise<void> {
  const { eventId, endpointId, attemptNumber } = payload;

  // Load the event and its endpoint
  const event = await prisma.webhookEvent.findUnique({
    where: { id: eventId },
    include: { endpoint: true },
  });

  if (!event) {
    throw new Error(`Webhook event not found: ${eventId}`);
  }

  if (!event.endpoint.isActive) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        message: "Skipping delivery: endpoint is inactive",
        eventId,
        endpointId,
      }),
    );
    return;
  }

  // TODO: Actually send the HTTP request to event.endpoint.url
  // For now, record a successful delivery attempt as a placeholder
  const startTime = Date.now();

  try {
    // Placeholder: simulate delivery
    // In production, this would be an HTTP POST to event.endpoint.url
    // with event.payload as the body and event.headers as headers.

    const durationMs = Date.now() - startTime;

    await prisma.deliveryAttempt.create({
      data: {
        eventId,
        attemptNumber,
        status: "SUCCESS",
        responseCode: 200,
        durationMs,
      },
    });

    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: "DELIVERED" },
    });

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        message: "Delivery attempt recorded",
        eventId,
        endpointId,
        attemptNumber,
        durationMs,
      }),
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;

    await prisma.deliveryAttempt.create({
      data: {
        eventId,
        attemptNumber,
        status: "FAILED",
        errorMessage:
          error instanceof Error ? error.message : "Unknown error",
        durationMs,
      },
    });

    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: attemptNumber >= 3 ? "FAILED" : "RETRYING" },
    });

    throw error; // Re-throw so BullMQ marks job as failed and retries
  }
}
