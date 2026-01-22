import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), "apps/web/.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("Missing Supabase environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

async function deleteUserByEmail(email: string) {
    console.log(`Attempting to delete user with email: ${email}`);

    // 1. Find the user by email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error("Error listing users:", listError.message);
        return;
    }

    console.log(`Total users found: ${users.length}`);
    if (users.length > 0) {
        console.log("Sample users (first 5 or fewer):");
        users.slice(0, 5).forEach(u => console.log(`- ${u.email} (${u.id})`));
    }

    const user = users.find((u) => u.email === email);
    let userId = user?.id;

    if (user) {
        console.log(`Found user in Auth. ID: ${userId}`);
        // 2. Delete the user from Supabase Auth
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
        if (deleteError) {
            console.error("Error deleting user from Auth:", deleteError.message);
        } else {
            console.log(`Successfully deleted user ${email} from Auth.`);
        }
    } else {
        console.log(`User with email ${email} not found in Auth. Checking database for orphaned records...`);
        // Try to find the UID in the profiles table by email
        const { data: profileRecord, error: searchError } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", email)
            .single();

        if (profileRecord) {
            userId = profileRecord.id;
            console.log(`Found orphaned profile record with ID: ${userId}`);
        } else if (searchError) {
            console.log(`No orphaned profile found for email ${email}. (Error: ${searchError.message})`);
        }
    }

    if (userId) {
        console.log(`Cleaning up database records for UID: ${userId}`);

        // Delete from user_credits
        const { error: creditError } = await supabase.from("user_credits").delete().eq("user_id", userId);
        if (creditError) console.error("Error deleting from user_credits:", creditError.message);
        else console.log("Cleaned up user_credits.");

        // Delete from profiles
        const { error: profileError } = await supabase.from("profiles").delete().eq("id", userId);
        if (profileError) console.error("Error deleting from profiles:", profileError.message);
        else console.log("Cleaned up profiles.");

        console.log("Database cleanup finished.");
    } else {
        console.log("No User ID found to clean up database records.");
    }
}

const targetEmail = process.argv[2] || "237645143@qq.com";
if (!process.argv[2]) {
    console.log(`No email provided. Using default: ${targetEmail}`);
}
deleteUserByEmail(targetEmail).catch((err) => {
    console.error("Unexpected error:", err);
});
