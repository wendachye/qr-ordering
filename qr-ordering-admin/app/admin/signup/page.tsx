"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";

const schema = z.object({
  restaurantName: z
    .string()
    .trim()
    .min(2, "Restaurant name is required")
    .max(80, "Name is too long"),
  ownerName: z.string().trim().max(80, "Name is too long").optional(),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});

type SignupValues = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  // `register` from react-hook-form below; alias the auth one to avoid the clash.
  const { status, register: createAccount } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  // If already authenticated, skip the signup screen.
  useEffect(() => {
    if (status === "authenticated") router.replace("/admin/floor");
  }, [status, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(schema),
    defaultValues: { restaurantName: "", ownerName: "", email: "", password: "" },
  });

  const onSubmit = async (values: SignupValues) => {
    setFormError(null);
    try {
      await createAccount({
        restaurantName: values.restaurantName,
        email: values.email,
        password: values.password,
        ownerName: values.ownerName || undefined,
      });
      router.replace("/admin/floor");
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Could not create your account. Please try again."
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-600 text-2xl font-black text-white">
            Q
          </span>
          <h1 className="text-3xl font-black text-slate-900">Start your restaurant</h1>
          <p className="mt-1 text-slate-500">
            Create your QR ordering workspace in seconds
          </p>
        </div>

        <Card>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div>
                <Label htmlFor="restaurantName">Restaurant name</Label>
                <Input
                  id="restaurantName"
                  placeholder="e.g. Nova Cafe"
                  {...register("restaurantName")}
                />
                <FieldError>{errors.restaurantName?.message}</FieldError>
              </div>

              <div>
                <Label htmlFor="ownerName">
                  Your name{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </Label>
                <Input
                  id="ownerName"
                  autoComplete="name"
                  placeholder="e.g. Pat Tan"
                  {...register("ownerName")}
                />
                <FieldError>{errors.ownerName?.message}</FieldError>
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@restaurant.com"
                  {...register("email")}
                />
                <FieldError>{errors.email?.message}</FieldError>
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  {...register("password")}
                />
                <FieldError>{errors.password?.message}</FieldError>
              </div>

              {formError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {formError}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating your workspace…" : "Create restaurant"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            href="/admin/login"
            className="font-semibold text-accent-600 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
