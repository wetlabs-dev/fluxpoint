import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

const coverStyles = [
  ["#123f46", "#6f9673", "#d5bd84"],
  ["#163b57", "#58a6a6", "#e2c884"],
  ["#173f36", "#8ca66b", "#d9b56f"],
  ["#0f4a56", "#6ba39a", "#e8d6a5"],
  ["#203a44", "#859b79", "#d7b56d"],
  ["#172c3b", "#477d82", "#c9a96c"]
];

const tankNames = ["Driftlake", "Sunstream", "Springhollow", "Mossglow", "Rockmere", "Duskbrook"];

async function ensureSpecies() {
  const definitions = [
    {
      category: "FISH" as const,
      commonName: "Ember Tetra",
      scientificName: "Hyphessobrycon amandae",
      genus: "Hyphessobrycon",
      species: "amandae",
      tempMin: 72,
      tempMax: 82,
      phMin: 5.5,
      phMax: 7.5,
      careNotes: "Peaceful schooling fish for planted aquariums."
    },
    {
      category: "PLANT" as const,
      commonName: "Java Fern",
      scientificName: "Microsorum pteropus",
      genus: "Microsorum",
      species: "pteropus",
      careNotes: "Attach to wood or stone; do not bury rhizome."
    },
    {
      category: "INVERT" as const,
      commonName: "Amano Shrimp",
      scientificName: "Caridina multidentata",
      genus: "Caridina",
      species: "multidentata",
      careNotes: "Strong algae grazer; prefers mature stable tanks."
    }
  ];

  return Promise.all(
    definitions.map(async (definition) => {
      const existing = await prisma.speciesDefinition.findFirst({ where: { commonName: definition.commonName } });
      return existing ?? prisma.speciesDefinition.create({ data: definition });
    })
  );
}

async function ensureWorkflowTemplates() {
  const workflowData = [
    ["Weekly Maintenance", "MAINTENANCE", ["Test water", "Water change", "Trim plants", "Inspect equipment"]],
    ["New Fish Quarantine", "QUARANTINE", ["Set observation tank", "Acclimate fish", "Daily health check", "Transfer when cleared"]],
    ["Medication Course", "MEDICATION", ["Confirm diagnosis", "Dose medication", "Track response", "Run carbon after course"]],
    ["New Tank Cycling", "CYCLING", ["Start filter", "Dose ammonia", "Track nitrite", "Confirm nitrate"]],
    ["Vacation Prep", "VACATION", ["Pre-measure food", "Top off water", "Check timers", "Leave keeper notes"]],
    ["Acclimation Checklist", "ACCLIMATION", ["Float bag", "Drip acclimate", "Net transfer", "Log behavior"]]
  ] as const;

  for (const [name, category, steps] of workflowData) {
    const existing = await prisma.workflowTemplate.findFirst({ where: { name } });
    if (existing) continue;

    await prisma.workflowTemplate.create({
      data: {
        name,
        category,
        isSystem: true,
        description: `${name} starter routine for Fluxpoint care operations.`,
        steps: {
          create: steps.map((title, index) => ({
            order: index + 1,
            title,
            stepType: index === 0 ? "CHECK" : "TASK",
            description: `Seeded step for ${name}.`,
            config: { required: index < 2 }
          }))
        }
      }
    });
  }
}

async function ensureLocations(collectionId: string) {
  const locationData = [
    { key: "livingRoom", name: "Living room", type: "ROOM" as const, sortOrder: 10 },
    { key: "fishRoom", name: "Fish room", type: "ROOM" as const, sortOrder: 20 },
    { key: "studioWall", name: "Studio wall", type: "RACK" as const, sortOrder: 30 },
    { key: "kitchenNook", name: "Kitchen nook", type: "SHELF" as const, sortOrder: 40 },
    { key: "utilityRack", name: "Utility rack", type: "RACK" as const, sortOrder: 50 },
    { key: "bedroom", name: "Bedroom", type: "ROOM" as const, sortOrder: 60 }
  ];

  const entries: Record<string, { id: string; name: string }> = {};
  for (const location of locationData) {
    const existing = await prisma.location.findFirst({ where: { collectionId, name: location.name } });
    entries[location.key] = existing ?? await prisma.location.create({
      data: {
        collectionId,
        name: location.name,
        type: location.type,
        sortOrder: location.sortOrder,
        description: "Seeded Fluxpoint starter location."
      }
    });
  }
  return entries;
}

async function ensureSources(collectionId: string) {
  const sourceData = [
    { key: "localShop", name: "Local aquatics shop", type: "STORE" as const },
    { key: "clubSwap", name: "Local club swap", type: "LOCAL_CLUB" as const },
    { key: "propagationTray", name: "Propagation tray", type: "SELF_PROPAGATED" as const },
    { key: "aquaticArts", name: "Aquatic Arts", type: "ONLINE_VENDOR" as const, website: "https://aquaticarts.com" },
    { key: "dansFish", name: "Dan's Fish", type: "ONLINE_VENDOR" as const, website: "https://dansfish.com" }
  ];

  const entries: Record<string, { id: string; name: string }> = {};
  for (const source of sourceData) {
    const existing = await prisma.source.findFirst({ where: { collectionId, name: source.name } });
    entries[source.key] = existing ?? await prisma.source.create({
      data: {
        collectionId,
        name: source.name,
        type: source.type,
        website: source.website,
        notes: "Seeded Fluxpoint starter source."
      }
    });
  }
  return entries;
}

async function ensureLightingSchedules(collectionId: string) {
  const existing = await prisma.lightingSchedule.findFirst({ where: { collectionId, name: "Soft Planted Day" } });
  if (existing) return existing;

  return prisma.lightingSchedule.create({
    data: {
      collectionId,
      name: "Soft Planted Day",
      description: "Seeded gentle ramp for low-to-medium tech freshwater displays.",
      points: {
        create: [
          { timeOfDay: "10:00", white: 20, red: 10, green: 10, blue: 20, intensity: 35, sortOrder: 10 },
          { timeOfDay: "14:00", white: 70, red: 35, green: 40, blue: 70, intensity: 80, sortOrder: 20 },
          { timeOfDay: "20:00", white: 0, red: 0, green: 0, blue: 0, intensity: 0, sortOrder: 30 }
        ]
      }
    }
  });
}

async function ensureSampleAquariums(collectionId: string, userId: string) {
  const locations = await ensureLocations(collectionId);
  const sources = await ensureSources(collectionId);
  const lightingSchedule = await ensureLightingSchedules(collectionId);
  const existingCount = await prisma.aquarium.count();
  if (existingCount > 0) return;

  const species = await ensureSpecies();
  const locationOrder = [locations.livingRoom, locations.fishRoom, locations.studioWall, locations.kitchenNook, locations.utilityRack, locations.bedroom];

  const aquariums = await Promise.all(
    tankNames.map((generatedName, index) =>
      prisma.aquarium.create({
        data: {
          collectionId,
          name: `${generatedName} display`,
          generatedName,
          slug: generatedName.toLowerCase(),
          description: `${generatedName} is a seeded Fluxpoint sample tank with reusable cover card styling.`,
          tankType: index === 4 ? "QUARANTINE" : "FRESHWATER",
          volumeGallons: [22, 12, 40, 9, 15, 29][index],
          lengthInches: [24, 20, 36, 18, 24, 30][index],
          widthInches: [12, 10, 18, 9, 12, 12][index],
          heightInches: [18, 12, 16, 10, 24, 18][index],
          location: ["Living room", "Office shelf", "Studio wall", "Kitchen nook", "Utility rack", "Bedroom"][index],
          locationId: locationOrder[index]?.id,
          status: index === 2 ? "PLANNING" : "ACTIVE",
          startedAt: new Date(Date.now() - (index + 1) * 1000 * 60 * 60 * 24 * 38),
          notes: "Seeded by Fluxpoint bootstrap.",
          coverCardStyle: {
            palette: coverStyles[index],
            mood: ["quiet driftwood meadow", "sunlit nano stream", "spring-fed planted layout", "low-tech moss garden", "clean observation setup", "dusky creek bend"][index],
            motif: ["branching wood and val", "sparkling stems and sand", "crypts and round stones", "moss ledges", "bare-bottom quarantine marks", "shadowed riverbank planting"][index],
            typographyStyle: "warm editorial sans",
            backgroundType: "layered water gradient",
            accentIllustrations: ["waterline", "plant silhouettes", "sand ripple"],
            promptText: `Illustrated Fluxpoint cover card for ${generatedName}.`
          },
          profile: {
            create: {
              lightingSchedule: "13:00-20:00",
              filtration: index === 4 ? "Sponge filter" : "Canister filter",
              heating: "Adjustable heater",
              co2: index % 2 === 0 ? "Pressurized CO2" : "None",
              waterSource: "Remineralized RO",
              targetTemperature: 76,
              targetPh: 6.8,
              targetGh: 6,
              targetKh: 2,
              notes: "Vibe notes available for AI cover and naming prompts."
            }
          }
        }
      })
    )
  );

  for (const [index, aquarium] of aquariums.entries()) {
    await prisma.aquariumItem.createMany({
      data: [
        {
          aquariumId: aquarium.id,
          collectionId,
          itemType: "FISH",
          speciesDefinitionId: species[0].id,
          name: "Ember tetra group",
          quantity: index === 4 ? 0 : 14,
          unit: "fish",
          sourceId: sources.localShop.id,
          purchasePrice: index === 4 ? null : "42.00",
          acquiredFrom: "Local aquatics shop",
          acquiredAt: new Date(),
          notes: "Generic item instance linked to a species definition."
        },
        {
          aquariumId: aquarium.id,
          collectionId,
          itemType: "PLANT",
          speciesDefinitionId: species[1].id,
          name: "Java fern clump",
          quantity: 3,
          unit: "rhizomes",
          sourceId: sources.propagationTray.id,
          purchasePrice: "0.00",
          acquiredFrom: "Propagation tray",
          acquiredAt: new Date()
        },
        {
          aquariumId: aquarium.id,
          collectionId,
          itemType: "HARDSCAPE",
          name: "Dragon stone cluster",
          quantity: 1,
          unit: "layout",
          sourceId: sources.clubSwap.id,
          purchasePrice: "18.00",
          acquiredFrom: "Storage"
        }
      ]
    });

    const substrate = await prisma.aquariumItem.create({
      data: {
        aquariumId: aquarium.id,
        collectionId,
        itemType: "SUBSTRATE",
        name: index === 4 ? "Bare-bottom setup" : "Aquasoil and sand cap",
        quantity: index === 4 ? 0 : 1,
        unit: index === 4 ? "setup" : "bag",
        sourceId: sources.localShop.id,
        purchasePrice: index === 4 ? "0.00" : "32.00",
        acquiredFrom: "Local aquatics shop",
        acquiredAt: new Date(),
        notes: "Structured substrate record for aquarium profile selectors."
      }
    });

    const light = await prisma.aquariumItem.create({
      data: {
        aquariumId: aquarium.id,
        collectionId,
        itemType: "EQUIPMENT",
        name: `${aquarium.generatedName} light`,
        quantity: 1,
        status: "ACTIVE",
        sourceId: sources.aquaticArts.id,
        purchasePrice: "89.00",
        equipmentProfile: {
          create: {
            equipmentType: "LIGHT",
            brand: "FluxRay",
            model: `WRGB-${index + 1}`,
            purchaseDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180),
            maintenanceIntervalDays: 30,
            lastMaintainedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * (index * 7 + 10)),
            notes: "Seeded equipment profile."
          }
        }
      }
    });

    await prisma.aquariumProfile.update({
      where: { aquariumId: aquarium.id },
      data: {
        substrateItemId: substrate.id,
        lightItemId: light.id
      }
    });

    await prisma.aquariumLightingAssignment.create({
      data: {
        aquariumId: aquarium.id,
        equipmentItemId: light.id,
        scheduleId: lightingSchedule.id,
        notes: "Seeded starter lighting assignment."
      }
    });

    await prisma.waterParameterReading.createMany({
      data: [
        { aquariumId: aquarium.id, parameter: "TEMPERATURE", value: 75.8 + index * 0.2, unit: "F", source: "MANUAL" },
        { aquariumId: aquarium.id, parameter: "PH", value: 6.7 + index * 0.05, unit: "pH", source: "MANUAL" },
        { aquariumId: aquarium.id, parameter: "NITRATE", value: 8 + index, unit: "ppm", source: "MANUAL" }
      ]
    });

    await prisma.aquariumEvent.createMany({
      data: [
        {
          aquariumId: aquarium.id,
          eventType: "WATER_CHANGE",
          title: "Weekly water change",
          summary: "Changed 30 percent and cleaned glass.",
          eventDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * (index + 1)),
          createdById: userId
        },
        {
          aquariumId: aquarium.id,
          eventType: "EQUIPMENT_CHANGE",
          title: "Lighting schedule reviewed",
          summary: `Checked ${light.name} intensity and photoperiod.`,
          eventDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * (index + 6)),
          createdById: userId
        }
      ]
    });
  }

  await prisma.sensorDevice.create({
    data: {
      aquariumId: aquariums[0].id,
      name: "Living room Pi bridge",
      deviceType: "RASPBERRY_PI",
      status: "ACTIVE",
      prometheusJob: "fluxpoint-living-room",
      channels: {
        create: [
          {
            parameter: "TEMPERATURE",
            displayName: "Water temperature",
            unit: "F",
            prometheusMetricName: "fluxpoint_water_temperature_f"
          }
        ]
      }
    }
  });

  await prisma.aiSuggestion.createMany({
    data: aquariums.slice(0, 3).map((aquarium) => ({
      aquariumId: aquarium.id,
      suggestionType: "COVER_CARD",
      prompt: "Bootstrap sample cover card concept",
      response: {
        palette: ["#123f46", "#6f9673", "#d5bd84"],
        mood: "soft planted current",
        motif: "waterline, moss, and rounded river stones"
      },
      selected: false
    }))
  });

  const starterScheduleData = [
    ["Daily feeding", "FEEDING", "DAILY", 1],
    ["Weekly parameter test", "TESTING", "WEEKLY", 7],
    ["Weekly water change", "WATER_CHANGE", "WEEKLY", 7],
    ["Monthly filter service", "EQUIPMENT_SERVICE", "MONTHLY", 30]
  ] as const;
  for (const [name, scheduleType, cadenceType] of starterScheduleData) {
    const aquarium = aquariums[0];
    const dueAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    const schedule = await prisma.careSchedule.create({
      data: {
        collectionId,
        aquariumId: aquarium.id,
        name,
        description: `${name} starter schedule from Fluxpoint bootstrap.`,
        scheduleType,
        cadenceType,
        intervalDays: cadenceType === "DAILY" ? 1 : cadenceType === "WEEKLY" ? 7 : null,
        startDate: dueAt,
        nextDueAt: dueAt
      }
    });
    await prisma.careTask.create({
      data: {
        careScheduleId: schedule.id,
        aquariumId: aquarium.id,
        title: name,
        description: schedule.description,
        dueAt
      }
    });
  }
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || "keeper@fluxpoint.local";
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME?.trim() || "Fluxpoint Keeper";

  if (!process.env.ADMIN_EMAIL || !adminPassword) {
    console.warn("Fluxpoint bootstrap warning: ADMIN_EMAIL and ADMIN_PASSWORD should be set before production login.");
  }

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      ...(adminPassword ? { passwordHash: await hashPassword(adminPassword) } : {})
    },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash: adminPassword ? await hashPassword(adminPassword) : null
    }
  });

  const collection =
    (await prisma.collection.findFirst({ where: { ownerId: user.id, name: "Home Aquariums" } })) ??
    (await prisma.collection.create({
      data: {
        name: "Home Aquariums",
        description: "A cozy working collection for freshwater, quarantine, and future reef systems.",
        ownerId: user.id
      }
    }));

  await ensureSpecies();
  await ensureWorkflowTemplates();
  await ensureSampleAquariums(collection.id, user.id);

  await prisma.auditLog.create({
    data: {
      entityType: "Collection",
      entityId: collection.id,
      action: "BOOTSTRAP",
      createdById: user.id,
      after: {
        user: user.email,
        collection: collection.name,
        aquariums: await prisma.aquarium.count(),
        workflows: await prisma.workflowTemplate.count()
      }
    }
  });

  console.log("Fluxpoint bootstrap complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
