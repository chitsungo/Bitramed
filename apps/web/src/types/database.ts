export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type QuizAttemptRow = {
  id: string;
  user_id: string;
  quiz_id: string;
  mode: string;
  score: number;
  total_questions: number;
  correct_count: number;
  wrong_count: number;
  unanswered_count: number;
  percentage: number;
  completed_at: string;
};

type ProgressRow = {
  user_id: string;
  assessment_kind: string;
  assessment_id: string;
  progress_key: string;
  mode: string;
  duration_minutes: number | null;
  negative_marking: boolean;
  context: Json;
  progress_data: Json;
  timer_expires_at: string | null;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      quiz_attempts: Table<
        QuizAttemptRow,
        Omit<QuizAttemptRow, "id" | "completed_at"> &
          Partial<Pick<QuizAttemptRow, "id" | "completed_at">>
      >;
      user_assessment_progress: Table<
        ProgressRow,
        Omit<ProgressRow, "updated_at"> &
          Partial<Pick<ProgressRow, "updated_at">>
      >;
      user_preferences: Table<
        { user_id: string; theme: string },
        { user_id: string; theme: string }
      >;
    };
    Views: Record<never, never>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: Json }>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
