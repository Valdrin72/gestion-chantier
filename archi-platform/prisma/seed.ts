import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("Seeding…");

  // Demo user + organisation
  const passwordHash = await bcrypt.hash("password123", 10);
  const demo = await db.user.upsert({
    where: { email: "demo@archi.test" },
    update: {},
    create: { email: "demo@archi.test", name: "Demo Architecte", passwordHash },
  });

  const org = await db.organization.upsert({
    where: { slug: "cabinet-demo" },
    update: {},
    create: { slug: "cabinet-demo", name: "Cabinet Demo" },
  });

  await db.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: demo.id } },
    update: {},
    create: { organizationId: org.id, userId: demo.id, role: "OWNER" },
  });

  // Catalogue d'éléments paramétrables
  const elementTypes = [
    {
      code: "WIN",
      name: "Fenêtre",
      category: "Menuiserie extérieure",
      defaultLifespanMonths: 30 * 12,
      fields: [
        { key: "largeur", label: "Largeur", kind: "DIMENSION", unit: "mm", required: true },
        { key: "hauteur", label: "Hauteur", kind: "DIMENSION", unit: "mm", required: true },
        { key: "materiau", label: "Matériau", kind: "SELECT", options: ["PVC", "Bois", "Aluminium", "Bois-alu"], required: true },
        { key: "vitrage", label: "Vitrage", kind: "SELECT", options: ["Simple", "Double", "Triple"] },
        { key: "ouverture", label: "Ouverture", kind: "SELECT", options: ["Fixe", "Battante", "Coulissante", "Oscillo-battante"] },
        { key: "couleur", label: "Couleur", kind: "COLOR" },
      ],
    },
    {
      code: "DOOR",
      name: "Porte",
      category: "Menuiserie",
      defaultLifespanMonths: 40 * 12,
      fields: [
        { key: "largeur", label: "Largeur", kind: "DIMENSION", unit: "mm" },
        { key: "hauteur", label: "Hauteur", kind: "DIMENSION", unit: "mm" },
        { key: "type", label: "Type", kind: "SELECT", options: ["Intérieure", "Extérieure", "Coupe-feu", "Coulissante"] },
        { key: "materiau", label: "Matériau", kind: "SELECT", options: ["Bois", "Métal", "PVC", "Verre"] },
      ],
    },
    {
      code: "WALL",
      name: "Mur",
      category: "Gros œuvre",
      defaultLifespanMonths: 80 * 12,
      fields: [
        { key: "longueur", label: "Longueur", kind: "DIMENSION", unit: "m" },
        { key: "hauteur", label: "Hauteur", kind: "DIMENSION", unit: "m" },
        { key: "epaisseur", label: "Épaisseur", kind: "DIMENSION", unit: "mm" },
        { key: "materiau", label: "Matériau", kind: "SELECT", options: ["Béton", "Brique", "Parpaing", "Bois", "Placo"] },
        { key: "isolant", label: "Isolation", kind: "TEXT" },
      ],
    },
    {
      code: "RAD",
      name: "Radiateur",
      category: "Chauffage",
      defaultLifespanMonths: 20 * 12,
      fields: [
        { key: "puissance", label: "Puissance", kind: "NUMBER", unit: "W" },
        { key: "type", label: "Type", kind: "SELECT", options: ["Acier", "Fonte", "Aluminium", "Sèche-serviette"] },
        { key: "raccordement", label: "Raccordement", kind: "SELECT", options: ["Eau chaude", "Électrique"] },
      ],
    },
  ];

  for (const t of elementTypes) {
    const et = await db.elementType.upsert({
      where: { organizationId_code: { organizationId: org.id, code: t.code } },
      update: {},
      create: {
        organizationId: org.id,
        code: t.code,
        name: t.name,
        category: t.category,
        defaultLifespanMonths: t.defaultLifespanMonths,
      },
    });
    for (let i = 0; i < t.fields.length; i++) {
      const f = t.fields[i];
      await db.elementTypeField.upsert({
        where: { elementTypeId_key: { elementTypeId: et.id, key: f.key } },
        update: {},
        create: {
          elementTypeId: et.id,
          key: f.key,
          label: f.label,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          kind: f.kind as any,
          required: Boolean((f as { required?: boolean }).required),
          options: (f as { options?: string[] }).options ?? undefined,
          unit: (f as { unit?: string }).unit,
          position: i,
        },
      });
    }
  }

  console.log("✅ Seed terminé. Login: demo@archi.test / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
