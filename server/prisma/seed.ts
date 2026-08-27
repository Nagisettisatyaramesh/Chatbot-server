import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertAdmin(email: string, password: string, role: "OWNER" | "SUPER_ADMIN", customerId: string | null) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.adminUser.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, role, customerId },
  });
}

async function main() {
  // Subscription plans (super admin configurable, shown to customers)
  await prisma.plan.upsert({
    where: { name: "STARTER" },
    update: {},
    create: { name: "STARTER", messageLimit: 1000, priceMonthly: 0 },
  });
  await prisma.plan.upsert({
    where: { name: "BUSINESS" },
    update: {},
    create: { name: "BUSINESS", messageLimit: 5000, priceMonthly: 49 },
  });
  await prisma.plan.upsert({
    where: { name: "PREMIUM" },
    update: {},
    create: { name: "PREMIUM", messageLimit: 20000, priceMonthly: 149 },
  });

  // Super admin (owner of the SaaS platform)
  await upsertAdmin("superadmin@aiwebsiteassistant.dev", "SuperAdmin123!", "SUPER_ADMIN", null);

  // ---------------------------------------------------------------
  // Demo Customer A: a photography business
  // ---------------------------------------------------------------
  const photo = await prisma.customer.upsert({
    where: { clientId: "PHOTOGRAPHY_001" },
    update: {},
    create: {
      clientId: "PHOTOGRAPHY_001",
      businessName: "Lumière Photography Studio",
      description: "A boutique photography studio specializing in weddings and pre-wedding shoots.",
      category: "Photography",
      websiteUrl: "https://example-photography.test",
      address: "12 Marina Road, Chennai, India",
      phone: "+91 90000 11111",
      email: "hello@lumierephoto.test",
      whatsapp: "+919000011111",
      businessHours: "Mon-Sat 10am-7pm",
      plan: "BUSINESS",
      messageLimit: 5000,
      chatbotSettings: {
        create: {
          botName: "Lumière Assistant",
          welcomeMessage: "Hi! 👋 Welcome to Lumière Photography. How can I help you today?",
          primaryColor: "#9333EA",
          buttonColor: "#9333EA",
          quickReplies: JSON.stringify(["Our Services", "Pricing", "Contact Us"]),
          handoffWhatsapp: "+919000011111",
          handoffPhone: "+919000011111",
          handoffEmail: "hello@lumierephoto.test",
          handoffEnquiryUrl: "https://example-photography.test/enquiry",
        },
      },
      knowledgeItems: {
        create: [
          {
            type: "ABOUT",
            title: "About Lumière Photography",
            content:
              "Lumière Photography Studio was founded in 2015 in Chennai. We specialize in wedding photography, pre-wedding shoots, and portrait sessions, with a candid, storytelling style.",
            status: "ACTIVE",
          },
          {
            type: "SERVICE",
            title: "Wedding Photography",
            content: "Full-day wedding coverage including candid and traditional shots, 2 photographers, edited digital album delivered within 3 weeks.",
            price: "₹45,000 onwards",
            status: "ACTIVE",
          },
          {
            type: "SERVICE",
            title: "Pre-Wedding Photography",
            content: "Outdoor or studio pre-wedding shoot, up to 4 hours, one location, 40 edited photos delivered.",
            price: "₹18,000 onwards",
            status: "ACTIVE",
          },
          {
            type: "SERVICE",
            title: "Portrait Sessions",
            content: "Individual or family portrait sessions in-studio, 1 hour, 15 edited photos.",
            price: "₹5,000 onwards",
            status: "ACTIVE",
          },
          {
            type: "FAQ",
            title: "Do you travel outside Chennai?",
            content: "Yes, we travel for weddings anywhere in India. Travel and accommodation costs are added to the package based on location.",
            status: "ACTIVE",
          },
          {
            type: "FAQ",
            title: "How long until we receive our photos?",
            content: "Edited photos are typically delivered within 2-3 weeks of the event.",
            status: "ACTIVE",
          },
          {
            type: "POLICY",
            title: "Booking & Cancellation Policy",
            content: "A 30% advance is required to confirm a booking. Cancellations made more than 30 days before the event receive a 50% refund of the advance; cancellations within 30 days are non-refundable.",
            status: "ACTIVE",
          },
        ],
      },
    },
  });
  await upsertAdmin("owner@lumierephoto.test", "Password123!", "OWNER", photo.id);

  // ---------------------------------------------------------------
  // Demo Customer B: a hotel
  // ---------------------------------------------------------------
  const hotel = await prisma.customer.upsert({
    where: { clientId: "HOTEL_002" },
    update: {},
    create: {
      clientId: "HOTEL_002",
      businessName: "Seaside Grand Hotel",
      description: "A 4-star beachfront hotel offering rooms, suites, and event facilities.",
      category: "Hospitality",
      websiteUrl: "https://example-hotel.test",
      address: "88 Beach Road, Goa, India",
      phone: "+91 90000 22222",
      email: "reservations@seasidegrand.test",
      whatsapp: "+919000022222",
      businessHours: "24/7 Front Desk",
      plan: "PREMIUM",
      messageLimit: 20000,
      chatbotSettings: {
        create: {
          botName: "Seaside Assistant",
          welcomeMessage: "Hi! 👋 Welcome to Seaside Grand Hotel. How can I help you today?",
          primaryColor: "#0EA5E9",
          buttonColor: "#0EA5E9",
          quickReplies: JSON.stringify(["Room Types", "Check-in/Check-out", "Contact Us"]),
          handoffWhatsapp: "+919000022222",
          handoffPhone: "+919000022222",
          handoffEmail: "reservations@seasidegrand.test",
          handoffEnquiryUrl: "https://example-hotel.test/enquiry",
        },
      },
      knowledgeItems: {
        create: [
          {
            type: "ABOUT",
            title: "About Seaside Grand Hotel",
            content: "Seaside Grand Hotel is a 4-star beachfront property in Goa with 120 rooms, a pool, spa, and banquet facilities for events.",
            status: "ACTIVE",
          },
          {
            type: "SERVICE",
            title: "Standard Rooms",
            content: "City-view standard rooms with king or twin beds, free WiFi, breakfast included.",
            price: "₹4,500/night",
            status: "ACTIVE",
          },
          {
            type: "SERVICE",
            title: "Deluxe Rooms",
            content: "Sea-view deluxe rooms with a balcony, king bed, free WiFi, breakfast included.",
            price: "₹7,000/night",
            status: "ACTIVE",
          },
          {
            type: "SERVICE",
            title: "Premium Suites",
            content: "Premium suites with a private balcony, living area, sea view, breakfast and airport pickup included.",
            price: "₹15,000/night",
            status: "ACTIVE",
          },
          {
            type: "FAQ",
            title: "What time is check-in and check-out?",
            content: "Check-in is at 2:00 PM and check-out is at 11:00 AM. Early check-in/late check-out is subject to availability.",
            status: "ACTIVE",
          },
          {
            type: "FAQ",
            title: "Do you have parking?",
            content: "Yes, complimentary parking is available for all guests.",
            status: "ACTIVE",
          },
          {
            type: "POLICY",
            title: "Cancellation Policy",
            content: "Free cancellation up to 48 hours before check-in. Cancellations within 48 hours are charged one night's stay.",
            status: "ACTIVE",
          },
        ],
      },
    },
  });
  await upsertAdmin("owner@seasidegrand.test", "Password123!", "OWNER", hotel.id);

  // ---------------------------------------------------------------
  // Real customer: Unique Creations (photography2-two.vercel.app)
  // ---------------------------------------------------------------
  const uniqueCreations = await prisma.customer.upsert({
    where: { clientId: "UNIQUE_CREATIONS_001" },
    update: {},
    create: {
      clientId: "UNIQUE_CREATIONS_001",
      businessName: "Unique Creations",
      description:
        "Unique Creations specializes in professional photography and videography, capturing weddings and a wide range of events with candid, cinematic storytelling.",
      category: "Photography & Videography",
      websiteUrl: "https://photography2-two.vercel.app/",
      plan: "STARTER",
      messageLimit: 1000,
      chatbotSettings: {
        create: {
          botName: "Unique Creations Assistant",
          welcomeMessage: "Hi! 👋 Welcome to Unique Creations. How can I help you plan your story today?",
          primaryColor: "#111111",
          buttonColor: "#111111",
          quickReplies: JSON.stringify(["Our Services", "Get a Quote"]),
          // DEMO values -- replace with the real WhatsApp/phone/enquiry link
          // in the admin portal (Chatbot Settings) before real customers use this.
          handoffWhatsapp: "+919000033333",
          handoffPhone: "+919000033333",
          handoffEnquiryUrl: "https://photography2-two.vercel.app/#contact",
        },
      },
      knowledgeItems: {
        create: [
          {
            type: "ABOUT",
            title: "About Unique Creations",
            content:
              "Unique Creations is a wedding photography and videography studio based in Andhra Pradesh, specializing in candid, cinematic coverage of weddings and events -- from Haldi and makeover functions to the wedding day itself.",
            status: "ACTIVE",
          },
          {
            type: "SERVICE",
            title: "Wedding Photography",
            content: "A complete visual story of your celebration -- candid and traditional coverage that moves with the day rather than staging it.",
            price: "Starting from ₹1,50,000",
            status: "ACTIVE",
          },
          {
            type: "SERVICE",
            title: "Cinematic Wedding Films",
            content: "Your day, cut to be watched again -- a film built around sound, pace and the moments that mattered most.",
            price: "Starting from ₹1,20,000",
            status: "ACTIVE",
          },
          {
            type: "SERVICE",
            title: "Pre-Wedding Shoot",
            content: "A relaxed shoot away from the wedding-day schedule, designed to capture the chemistry between the two of you before the big day.",
            price: "Starting from ₹45,000",
            status: "ACTIVE",
          },
          {
            type: "SERVICE",
            title: "Haldi & Makeover Coverage",
            content: "The colour, ritual and candid joy of Haldi and makeover functions -- every detail preserved as it actually happened.",
            price: "Starting from ₹35,000",
            status: "ACTIVE",
          },
          {
            type: "FAQ",
            title: "How does the process work?",
            content:
              "It's a simple 6-step journey: 1) Enquire -- tell us your date and vision, we usually reply within a day. 2) Meet -- a call or in-person meeting to understand your story. 3) Customize -- we build a proposal around exactly what your day needs. 4) Celebrate -- you focus on the day, we stay quietly close. 5) Capture -- every ritual and reaction documented as it happens. 6) Relive -- galleries, films and albums delivered for you to return to for years.",
            status: "ACTIVE",
          },
          {
            type: "FAQ",
            title: "How do I get a quote?",
            content: "Every wedding is different, so we build a personalised quote based on your events, coverage, location and deliverables. Tell us your date and vision through our enquiry form and we'll get back to you, usually within a day.",
            status: "ACTIVE",
          },
        ],
      },
    },
  });
  await upsertAdmin("owner@uniquecreations.test", "TempPass123!", "OWNER", uniqueCreations.id);

  console.log("Seed complete.");
  console.log("Super admin login: superadmin@aiwebsiteassistant.dev / SuperAdmin123!");
  console.log("Customer A (photography demo) login: owner@lumierephoto.test / Password123!  clientId=PHOTOGRAPHY_001");
  console.log("Customer B (hotel demo) login: owner@seasidegrand.test / Password123!  clientId=HOTEL_002");
  console.log("Customer C (real: Unique Creations) login: owner@uniquecreations.test / TempPass123!  clientId=UNIQUE_CREATIONS_001");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
