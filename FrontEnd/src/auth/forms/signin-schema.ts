import { z } from 'zod';

export const getSigninSchema = () => {
  return z.object({
    username: z
      .string()
      .min(2, { message: 'Το όνομα  χρήστη απαιτείται.' }),
    password: z.string().min(1, { message: 'Ο Κωδικός απαιτείται.' }),
    //rememberMe: z.boolean().optional(),
  });
};

export type SigninSchemaType = z.infer<ReturnType<typeof getSigninSchema>>;
