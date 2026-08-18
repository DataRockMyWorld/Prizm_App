from django.db import migrations

CATEGORIES = [
    dict(name="Cleaning", slug="cleaning", estimate_min="150.00", estimate_max="300.00"),
    dict(name="Plumbing", slug="plumbing", estimate_min="200.00", estimate_max="500.00"),
    dict(name="Electrical", slug="electrical", estimate_min="250.00", estimate_max="600.00"),
]


def seed_categories(apps, schema_editor):
    ServiceCategory = apps.get_model("services", "ServiceCategory")
    for category in CATEGORIES:
        ServiceCategory.objects.get_or_create(slug=category["slug"], defaults=category)


def remove_categories(apps, schema_editor):
    ServiceCategory = apps.get_model("services", "ServiceCategory")
    ServiceCategory.objects.filter(
        slug__in=[category["slug"] for category in CATEGORIES]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("services", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_categories, remove_categories),
    ]
