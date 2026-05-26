export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      athlete_benchmarks: {
        Row: {
          athlete_id: string
          id: string
          metric_name: string
          recorded_at: string
          unit: string | null
          user_id: string
          value: number
        }
        Insert: {
          athlete_id: string
          id?: string
          metric_name: string
          recorded_at?: string
          unit?: string | null
          user_id: string
          value: number
        }
        Update: {
          athlete_id?: string
          id?: string
          metric_name?: string
          recorded_at?: string
          unit?: string | null
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "athlete_benchmarks_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_goals: {
        Row: {
          athlete_id: string
          created_at: string
          current_value: number | null
          id: string
          metric_name: string
          target_date: string | null
          target_value: number
          unit: string | null
          user_id: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          current_value?: number | null
          id?: string
          metric_name: string
          target_date?: string | null
          target_value: number
          unit?: string | null
          user_id: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          current_value?: number | null
          id?: string
          metric_name?: string
          target_date?: string | null
          target_value?: number
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_goals_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes: {
        Row: {
          age: number | null
          avatar_url: string | null
          club: string | null
          created_at: string
          drill_plan: Json | null
          fencing_tracker_data: Json | null
          fencing_tracker_updated_at: string | null
          fencing_tracker_url: string | null
          height_cm: number | null
          id: string
          name: string
          position: string | null
          rating: string | null
          sport: string
          team: string | null
          user_id: string
          weapon: string | null
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          club?: string | null
          created_at?: string
          drill_plan?: Json | null
          fencing_tracker_data?: Json | null
          fencing_tracker_updated_at?: string | null
          fencing_tracker_url?: string | null
          height_cm?: number | null
          id?: string
          name: string
          position?: string | null
          rating?: string | null
          sport: string
          team?: string | null
          user_id: string
          weapon?: string | null
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          club?: string | null
          created_at?: string
          drill_plan?: Json | null
          fencing_tracker_data?: Json | null
          fencing_tracker_updated_at?: string | null
          fencing_tracker_url?: string | null
          height_cm?: number | null
          id?: string
          name?: string
          position?: string | null
          rating?: string | null
          sport?: string
          team?: string | null
          user_id?: string
          weapon?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      benchmarks: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          speed_analysis: Json | null
          user_id: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          speed_analysis?: Json | null
          user_id: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          speed_analysis?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      fencing_actions: {
        Row: {
          action_type: string
          created_at: string
          fencing_session_id: string
          id: string
          notes: string | null
          successful: boolean
          timestamp_seconds: number | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          fencing_session_id: string
          id?: string
          notes?: string | null
          successful?: boolean
          timestamp_seconds?: number | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          fencing_session_id?: string
          id?: string
          notes?: string | null
          successful?: boolean
          timestamp_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fencing_actions_fencing_session_id_fkey"
            columns: ["fencing_session_id"]
            isOneToOne: false
            referencedRelation: "fencing_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      fencing_sensor_reps: {
        Row: {
          attack_speed_ms: number | null
          created_at: string
          fencing_session_id: string | null
          footwork_cadence: number | null
          id: string
          left_speed_ms: number | null
          rep_number: number
          right_speed_ms: number | null
          timestamp_seconds: number | null
          user_id: string
          video_id: string | null
        }
        Insert: {
          attack_speed_ms?: number | null
          created_at?: string
          fencing_session_id?: string | null
          footwork_cadence?: number | null
          id?: string
          left_speed_ms?: number | null
          rep_number: number
          right_speed_ms?: number | null
          timestamp_seconds?: number | null
          user_id: string
          video_id?: string | null
        }
        Update: {
          attack_speed_ms?: number | null
          created_at?: string
          fencing_session_id?: string | null
          footwork_cadence?: number | null
          id?: string
          left_speed_ms?: number | null
          rep_number?: number
          right_speed_ms?: number | null
          timestamp_seconds?: number | null
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fencing_sensor_reps_fencing_session_id_fkey"
            columns: ["fencing_session_id"]
            isOneToOne: false
            referencedRelation: "fencing_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      fencing_sessions: {
        Row: {
          bout_type: string | null
          created_at: string
          event_name: string | null
          id: string
          opponent: string | null
          result: string | null
          session_id: string
          speed_analysis: Json | null
          touches_received: number | null
          touches_scored: number | null
          user_id: string
          video_url: string | null
          weapon: string | null
        }
        Insert: {
          bout_type?: string | null
          created_at?: string
          event_name?: string | null
          id?: string
          opponent?: string | null
          result?: string | null
          session_id: string
          speed_analysis?: Json | null
          touches_received?: number | null
          touches_scored?: number | null
          user_id: string
          video_url?: string | null
          weapon?: string | null
        }
        Update: {
          bout_type?: string | null
          created_at?: string
          event_name?: string | null
          id?: string
          opponent?: string | null
          result?: string | null
          session_id?: string
          speed_analysis?: Json | null
          touches_received?: number | null
          touches_scored?: number | null
          user_id?: string
          video_url?: string | null
          weapon?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fencing_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      hockey_sprint_reps: {
        Row: {
          created_at: string
          hockey_session_id: string
          id: string
          is_pb: boolean | null
          load_kg: number | null
          load_pct: number | null
          pct_of_max: number | null
          peak_kmh: number | null
          phase: string
          rep_number: number
          split_5m: number | null
          split_7_5m: number | null
          time_10m: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          hockey_session_id: string
          id?: string
          is_pb?: boolean | null
          load_kg?: number | null
          load_pct?: number | null
          pct_of_max?: number | null
          peak_kmh?: number | null
          phase: string
          rep_number: number
          split_5m?: number | null
          split_7_5m?: number | null
          time_10m?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          hockey_session_id?: string
          id?: string
          is_pb?: boolean | null
          load_kg?: number | null
          load_pct?: number | null
          pct_of_max?: number | null
          peak_kmh?: number | null
          phase?: string
          rep_number?: number
          split_5m?: number | null
          split_7_5m?: number | null
          time_10m?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hockey_sprint_reps_hockey_session_id_fkey"
            columns: ["hockey_session_id"]
            isOneToOne: false
            referencedRelation: "hockey_sprint_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      hockey_sprint_sessions: {
        Row: {
          body_weight_kg: number | null
          created_at: string
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          body_weight_kg?: number | null
          created_at?: string
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          body_weight_kg?: number | null
          created_at?: string
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hockey_sprint_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      hockey_step_data: {
        Row: {
          created_at: string
          id: string
          left_speed_ms: number | null
          rep_id: string | null
          right_speed_ms: number | null
          step_length: number | null
          step_number: number
          step_time: number | null
          timestamp_seconds: number | null
          user_id: string
          video_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          left_speed_ms?: number | null
          rep_id?: string | null
          right_speed_ms?: number | null
          step_length?: number | null
          step_number: number
          step_time?: number | null
          timestamp_seconds?: number | null
          user_id: string
          video_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          left_speed_ms?: number | null
          rep_id?: string | null
          right_speed_ms?: number | null
          step_length?: number | null
          step_number?: number
          step_time?: number | null
          timestamp_seconds?: number | null
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hockey_step_data_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "hockey_sprint_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          location: string | null
          name: string | null
          notes: string | null
          session_date: string
          session_type: string
          sport: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          location?: string | null
          name?: string | null
          notes?: string | null
          session_date?: string
          session_type: string
          sport: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          location?: string | null
          name?: string | null
          notes?: string | null
          session_date?: string
          session_type?: string
          sport?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      video_ai_feedback: {
        Row: {
          created_at: string
          feedback: string | null
          id: string
          model: string | null
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          id?: string
          model?: string | null
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          feedback?: string | null
          id?: string
          model?: string | null
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_ai_feedback_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_keyframes: {
        Row: {
          created_at: string
          frame_index: number | null
          id: string
          thumbnail_url: string | null
          timestamp_seconds: number | null
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          frame_index?: number | null
          id?: string
          thumbnail_url?: string | null
          timestamp_seconds?: number | null
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          frame_index?: number | null
          id?: string
          thumbnail_url?: string | null
          timestamp_seconds?: number | null
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_keyframes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_pose_metrics: {
        Row: {
          created_at: string
          id: string
          keyframe_id: string
          metric_name: string
          user_id: string
          value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          keyframe_id: string
          metric_name: string
          user_id: string
          value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          keyframe_id?: string
          metric_name?: string
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_pose_metrics_keyframe_id_fkey"
            columns: ["keyframe_id"]
            isOneToOne: false
            referencedRelation: "video_keyframes"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          athlete_id: string | null
          created_at: string
          id: string
          label: string | null
          session_id: string | null
          status: string
          thumbnail_url: string | null
          user_id: string
          video_url: string | null
        }
        Insert: {
          athlete_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          session_id?: string | null
          status?: string
          thumbnail_url?: string | null
          user_id: string
          video_url?: string | null
        }
        Update: {
          athlete_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          session_id?: string | null
          status?: string
          thumbnail_url?: string | null
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      seed_demo_data_for_user: { Args: { _uid: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
