import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  PROMPT_SCOPES,
  createPublishingDraftsSchema,
  createVideoDraftsSchema,
  promptPresetInputSchema,
  publishingDraftUpdateSchema,
  scriptDraftInputSchema,
  scriptDraftUpdateSchema,
  videoDraftUpdateSchema,
} from '@acs/shared';
import { WorkspaceId } from '../auth/workspace.guard';
import { parseId } from '../common/params';
import { parseInput } from '../common/validation';
import { DraftsService } from './drafts.service';

const idsSchema = z.object({ ids: z.array(z.uuid()).min(1).max(500) });

@Controller('drafts/video')
export class VideoDraftsController {
  constructor(private readonly drafts: DraftsService) {}

  @Get()
  list(@WorkspaceId() ws: string) {
    return this.drafts.listVideo(ws);
  }

  @Post()
  create(@WorkspaceId() ws: string, @Body() body: unknown) {
    return this.drafts.createVideo(ws, parseInput(createVideoDraftsSchema, body).drafts);
  }

  /** Xoá nhiều: POST /drafts/video/delete { ids } */
  @Post('delete')
  removeMany(@WorkspaceId() ws: string, @Body() body: unknown) {
    return this.drafts.deleteVideo(ws, parseInput(idsSchema, body).ids);
  }

  @Patch(':id')
  update(@WorkspaceId() ws: string, @Param('id') id: string, @Body() body: unknown) {
    return this.drafts.updateVideo(ws, parseId(id), parseInput(videoDraftUpdateSchema, body));
  }

  @Delete(':id')
  remove(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.drafts.deleteVideo(ws, [parseId(id)]);
  }
}

@Controller('drafts/publishing')
export class PublishingDraftsController {
  constructor(private readonly drafts: DraftsService) {}

  @Get()
  list(@WorkspaceId() ws: string) {
    return this.drafts.listPublishing(ws);
  }

  @Post()
  create(@WorkspaceId() ws: string, @Body() body: unknown) {
    return this.drafts.createPublishing(ws, parseInput(createPublishingDraftsSchema, body).drafts);
  }

  @Post('delete')
  removeMany(@WorkspaceId() ws: string, @Body() body: unknown) {
    return this.drafts.deletePublishing(ws, parseInput(idsSchema, body).ids);
  }

  @Patch(':id')
  update(@WorkspaceId() ws: string, @Param('id') id: string, @Body() body: unknown) {
    return this.drafts.updatePublishing(
      ws,
      parseId(id),
      parseInput(publishingDraftUpdateSchema, body),
    );
  }

  @Delete(':id')
  remove(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.drafts.deletePublishing(ws, [parseId(id)]);
  }
}

@Controller('drafts/scripts')
export class ScriptDraftsController {
  constructor(private readonly drafts: DraftsService) {}

  @Get()
  list(@WorkspaceId() ws: string) {
    return this.drafts.listScripts(ws);
  }

  @Post()
  create(@WorkspaceId() ws: string, @Body() body: unknown) {
    return this.drafts.createScript(ws, parseInput(scriptDraftInputSchema, body));
  }

  @Patch(':id')
  update(@WorkspaceId() ws: string, @Param('id') id: string, @Body() body: unknown) {
    return this.drafts.updateScript(ws, parseId(id), parseInput(scriptDraftUpdateSchema, body));
  }

  @Delete(':id')
  remove(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.drafts.deleteScript(ws, parseId(id));
  }
}

@Controller('prompt-presets')
export class PromptPresetsController {
  constructor(private readonly drafts: DraftsService) {}

  @Get()
  list(@WorkspaceId() ws: string, @Query('scope') scope?: string) {
    return this.drafts.listPrompts(
      ws,
      scope ? parseInput(z.enum(PROMPT_SCOPES), scope) : undefined,
    );
  }

  @Post()
  create(@WorkspaceId() ws: string, @Body() body: unknown) {
    return this.drafts.createPrompt(ws, parseInput(promptPresetInputSchema, body));
  }

  @Delete(':id')
  remove(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.drafts.deletePrompt(ws, parseId(id));
  }
}
