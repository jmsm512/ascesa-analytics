// Sport configuration. The DB schema only has position/weapon/team/club columns,
// so each sport maps its two role fields onto one of those pairs.

export type SportKey =
  | "hockey"
  | "fencing"
  | "soccer"
  | "basketball"
  | "baseball"
  | "lacrosse"
  | "volleyball"
  | "tennis"
  | "track"
  | "swimming"
  | "golf";

type RoleField = {
  label: string;
  // Which DB column to write the value to.
  column: "position" | "weapon";
  options?: string[]; // if present -> <select>, else free text
};

type GroupField = {
  label: string;
  column: "team" | "club";
};

export type SportConfig = {
  label: string;
  color: string; // CSS var or hex
  role: RoleField;
  group: GroupField;
};

export const SPORTS: Record<SportKey, SportConfig> = {
  hockey: {
    label: "Hockey",
    color: "var(--hockey)",
    role: { label: "Position", column: "position", options: ["Defense", "Forward", "Goalie"] },
    group: { label: "Team", column: "team" },
  },
  fencing: {
    label: "Fencing",
    color: "var(--fencing)",
    role: { label: "Weapon", column: "weapon", options: ["Épée", "Foil", "Sabre"] },
    group: { label: "Club", column: "club" },
  },
  soccer: {
    label: "Soccer",
    color: "var(--hockey)",
    role: {
      label: "Position",
      column: "position",
      options: ["Goalkeeper", "Defender", "Midfielder", "Forward"],
    },
    group: { label: "Club", column: "club" },
  },
  basketball: {
    label: "Basketball",
    color: "var(--hockey)",
    role: {
      label: "Position",
      column: "position",
      options: ["Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Center"],
    },
    group: { label: "Team", column: "team" },
  },
  baseball: {
    label: "Baseball",
    color: "var(--hockey)",
    role: {
      label: "Position",
      column: "position",
      options: [
        "Pitcher",
        "Catcher",
        "First Base",
        "Second Base",
        "Third Base",
        "Shortstop",
        "Outfield",
      ],
    },
    group: { label: "Team", column: "team" },
  },
  lacrosse: {
    label: "Lacrosse",
    color: "var(--hockey)",
    role: {
      label: "Position",
      column: "position",
      options: ["Attack", "Midfield", "Defense", "Goalie"],
    },
    group: { label: "Team", column: "team" },
  },
  volleyball: {
    label: "Volleyball",
    color: "var(--fencing)",
    role: {
      label: "Position",
      column: "position",
      options: ["Setter", "Outside Hitter", "Middle Blocker", "Opposite", "Libero"],
    },
    group: { label: "Team", column: "team" },
  },
  tennis: {
    label: "Tennis",
    color: "var(--fencing)",
    role: { label: "Dominant Hand", column: "weapon", options: ["Right", "Left"] },
    group: { label: "Club", column: "club" },
  },
  track: {
    label: "Track & Field",
    color: "var(--fencing)",
    role: {
      label: "Event",
      column: "weapon",
      options: ["Sprints", "Distance", "Hurdles", "Jumps", "Throws"],
    },
    group: { label: "Club", column: "club" },
  },
  swimming: {
    label: "Swimming",
    color: "var(--fencing)",
    role: {
      label: "Stroke",
      column: "weapon",
      options: ["Freestyle", "Backstroke", "Breaststroke", "Butterfly", "IM"],
    },
    group: { label: "Club", column: "club" },
  },
  golf: {
    label: "Golf",
    color: "var(--fencing)",
    role: { label: "Dominant Hand", column: "weapon", options: ["Right", "Left"] },
    group: { label: "Club", column: "club" },
  },
};

export const SPORT_KEYS = Object.keys(SPORTS) as SportKey[];
