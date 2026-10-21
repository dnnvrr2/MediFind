import re
from rest_framework import serializers

DAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


def normalize_contact(value):
    value = re.sub(r"[\s()-]", "", value.strip())
    if value.startswith("+63"):
        remainder, expected = value[3:], 10
    elif value.startswith("09"):
        remainder, expected = value[2:], 9
    else:
        raise serializers.ValidationError("Start the mobile number with 09 or +63.")
    if not remainder.isdigit():
        raise serializers.ValidationError("Use digits only after the prefix.")
    if len(remainder) != expected:
        raise serializers.ValidationError(f"Use {expected} digits after {'+63' if expected == 10 else '09'}; received {len(remainder)}.")
    if expected == 10 and not remainder.startswith("9"):
        raise serializers.ValidationError("The digits after +63 must start with 9.")
    return value


def canonical_contact(value):
    return "+63" + value[1:] if value.startswith("09") else value


def validate_contacts(values):
    normalized = [normalize_contact(value) for value in values]
    if len({canonical_contact(value) for value in normalized}) != len(normalized):
        raise serializers.ValidationError("Remove duplicate contact numbers.")
    return normalized


def validate_schedule(rows):
    if not rows:
        return rows
    if len(rows) != 7 or {row["day"] for row in rows} != set(range(7)):
        raise serializers.ValidationError("Set each day of the week exactly once.")
    if not any(row["open"] for row in rows):
        raise serializers.ValidationError("Choose at least one opening day.")
    for row in rows:
        if row["open"] and not row["allDay"] and row["opens"] == row["closes"]:
            raise serializers.ValidationError("Opening and closing times must differ. Select 24 hours for all-day opening.")
    return sorted(rows, key=lambda row: row["day"])


def time_label(value):
    hour, minute = (int(part) for part in value.split(":"))
    return f"{hour % 12 or 12}:{minute:02} {'AM' if hour < 12 else 'PM'}"


def schedule_summary(rows):
    groups = []
    for row in rows:
        key = "closed" if not row["open"] else "24h" if row["allDay"] else row["opens"] + "-" + row["closes"]
        label = "Closed" if not row["open"] else "24 hours" if row["allDay"] else time_label(row["opens"]) + " - " + time_label(row["closes"]) + (" (+1 day)" if row["closes"] < row["opens"] else "")
        if groups and groups[-1][0] == key:
            groups[-1][1].append(DAYS[row["day"]])
        else:
            groups.append([key, [DAYS[row["day"]]], label])
    return "; ".join(("Every day" if len(days) == 7 else days[0] + "-" + days[-1] if len(days) > 2 else ", ".join(days)) + ": " + label for _, days, label in groups)
