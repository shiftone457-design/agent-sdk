import { describe, it, expect } from 'vitest';
import { parseSkillMd } from '../../src/skills/parser.js';

describe('Skill Parser', () => {
  it('should parse SKILL.md with frontmatter', () => {
    const content = `---
name: test-skill
description: "A test skill"
version: "1.0.0"
tags:
  - test
  - example
---

# Test Skill

This is a test skill.

## Instructions

Do something useful.`;

    const result = parseSkillMd(content);

    expect(result.metadata.name).toBe('test-skill');
    expect(result.metadata.description).toBe('A test skill');
    expect(result.metadata.version).toBe('1.0.0');
    expect(result.metadata.tags).toEqual(['test', 'example']);
    expect(result.content).toContain('# Test Skill');
    expect(result.content).toContain('Do something useful');
  });

  it('should parse SKILL.md without frontmatter', () => {
    const content = `# My Skill

This is a skill without frontmatter.

The name should be inferred from the title.`;

    const result = parseSkillMd(content);

    expect(result.metadata.name).toBe('my-skill');
    expect(result.content).toContain('# My Skill');
  });

  it('should handle empty frontmatter', () => {
    const content = `---
---

# Empty Frontmatter`;

    const result = parseSkillMd(content);

    expect(result.metadata.name).toBe('empty-frontmatter');
    expect(result.content).toContain('# Empty Frontmatter');
  });

  it('should parse array values in frontmatter', () => {
    const content = `---
name: array-test
tools:
  - tool1
  - tool2
dependencies:
  - dep1
  - dep2
---

Content here`;

    const result = parseSkillMd(content);

    expect(result.metadata.tools).toEqual(['tool1', 'tool2']);
    expect(result.metadata.dependencies).toEqual(['dep1', 'dep2']);
  });

  it('should handle quoted values', () => {
    const content = `---
name: 'quoted-name'
description: "quoted description"
---

Content`;

    const result = parseSkillMd(content);

    expect(result.metadata.name).toBe('quoted-name');
    expect(result.metadata.description).toBe('quoted description');
  });

  it('should handle comments in frontmatter', () => {
    const content = `---
# This is a comment
name: test
# Another comment
description: Test
---

Content`;

    const result = parseSkillMd(content);

    expect(result.metadata.name).toBe('test');
    expect(result.metadata.description).toBe('Test');
  });
});
