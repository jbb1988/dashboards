import { NextRequest, NextResponse } from 'next/server';

const NOTION_TOKEN = process.env.NOTION_API_KEY || '';
const DATABASE_ID = '206736c0-e519-4948-ad03-0786df66e7fc';
// Tasks database ID - will be discovered from contract relation or set manually
let TASKS_DATABASE_ID: string | null = null;

interface NotionTask {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  priority: string | null;
  assignee: string | null;
}

/**
 * GET - Fetch tasks from Notion
 * Query param: contractName (optional) - if provided, fetch tasks for specific contract
 * If no contractName, fetch all tasks across all contracts
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contractName = searchParams.get('contractName');

  // If contractName provided, fetch tasks for that specific contract
  if (contractName) {
    return getTasksForContract(contractName);
  }

  // Otherwise, fetch all tasks across all contracts
  return getAllTasks();
}

async function getAllTasks() {
  try {
    // First, get all contracts from Notion
    const contractsResponse = await fetch(
      `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page_size: 100,
        }),
      }
    );

    if (!contractsResponse.ok) {
      console.error('Notion contracts error:', await contractsResponse.text());
      return NextResponse.json({ tasks: [] });
    }

    const contractsData = await contractsResponse.json();
    const allTasks: any[] = [];

    // For each contract, get its tasks
    for (const contract of contractsData.results) {
      const contractName = contract.properties?.Name?.title?.[0]?.plain_text || 'Unknown';
      const taskRelations = contract.properties?.Tasks?.relation || [];

      for (const relation of taskRelations) {
        try {
          const taskResponse = await fetch(
            `https://api.notion.com/v1/pages/${relation.id}`,
            {
              headers: {
                'Authorization': `Bearer ${NOTION_TOKEN}`,
                'Notion-Version': '2022-06-28',
              },
            }
          );

          if (taskResponse.ok) {
            const taskPage = await taskResponse.json();
            const props = taskPage.properties;

            const title =
              props.Name?.title?.[0]?.plain_text ||
              props.Task?.title?.[0]?.plain_text ||
              props.Title?.title?.[0]?.plain_text ||
              'Untitled Task';

            const status =
              props.Status?.status?.name ||
              props.Status?.select?.name ||
              props['Task Status']?.status?.name ||
              'Unknown';

            const dueDate =
              props['Due Date']?.date?.start ||
              props.Due?.date?.start ||
              props.Deadline?.date?.start ||
              null;

            const priority =
              props.Priority?.select?.name ||
              props.Priority?.status?.name ||
              'medium';

            const completed = status.toLowerCase().includes('done') || status.toLowerCase().includes('complete');

            allTasks.push({
              id: relation.id,
              title,
              status,
              dueDate,
              priority: priority?.toLowerCase() || 'medium',
              completed,
              contractId: contract.id,
              contractName,
            });
          }
        } catch (err) {
          console.error(`Error fetching task ${relation.id}:`, err);
        }
      }
    }

    // Sort tasks: incomplete first, then by due date
    allTasks.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });

    return NextResponse.json({ tasks: allTasks });
  } catch (error) {
    console.error('Error fetching all tasks:', error);
    return NextResponse.json({ tasks: [] });
  }
}

async function getTasksForContract(contractName: string) {

  try {
    // First, find the contract page in Notion
    const searchResponse = await fetch(
      `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: {
            property: 'Name',
            title: { equals: contractName }
          },
          page_size: 1,
        }),
      }
    );

    if (!searchResponse.ok) {
      console.error('Notion search error:', await searchResponse.text());
      return NextResponse.json({ error: 'Failed to find contract' }, { status: 500 });
    }

    const searchData = await searchResponse.json();

    if (searchData.results.length === 0) {
      return NextResponse.json({ tasks: [], message: 'Contract not found in Notion' });
    }

    const contractPage = searchData.results[0];
    const taskRelations = contractPage.properties?.Tasks?.relation || [];

    if (taskRelations.length === 0) {
      return NextResponse.json({ tasks: [], message: 'No tasks linked to this contract' });
    }

    // Fetch each related task
    const tasks: NotionTask[] = [];

    for (const relation of taskRelations) {
      try {
        const taskResponse = await fetch(
          `https://api.notion.com/v1/pages/${relation.id}`,
          {
            headers: {
              'Authorization': `Bearer ${NOTION_TOKEN}`,
              'Notion-Version': '2022-06-28',
            },
          }
        );

        if (taskResponse.ok) {
          const taskPage = await taskResponse.json();
          const props = taskPage.properties;

          // Extract task properties - handle various possible property names
          const title =
            props.Name?.title?.[0]?.plain_text ||
            props.Task?.title?.[0]?.plain_text ||
            props.Title?.title?.[0]?.plain_text ||
            'Untitled Task';

          const status =
            props.Status?.status?.name ||
            props.Status?.select?.name ||
            props['Task Status']?.status?.name ||
            'Unknown';

          const dueDate =
            props['Due Date']?.date?.start ||
            props.Due?.date?.start ||
            props.Deadline?.date?.start ||
            null;

          const priority =
            props.Priority?.select?.name ||
            props.Priority?.status?.name ||
            null;

          const assignee =
            props.Assignee?.people?.[0]?.name ||
            props.Owner?.people?.[0]?.name ||
            null;

          tasks.push({
            id: relation.id,
            title,
            status,
            dueDate,
            priority,
            assignee,
          });
        }
      } catch (err) {
        console.error(`Error fetching task ${relation.id}:`, err);
      }
    }

    // Sort tasks: incomplete first, then by due date
    tasks.sort((a, b) => {
      // Put completed tasks at the end
      const aComplete = a.status.toLowerCase().includes('done') || a.status.toLowerCase().includes('complete');
      const bComplete = b.status.toLowerCase().includes('done') || b.status.toLowerCase().includes('complete');
      if (aComplete !== bComplete) return aComplete ? 1 : -1;

      // Sort by due date
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });

    return NextResponse.json({
      contractName,
      taskCount: tasks.length,
      tasks,
    });

  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

/**
 * PATCH - Update a task in Notion
 * Body: { taskId: string, updates: { status?: string, title?: string, dueDate?: string } }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { taskId, updates } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    // Build Notion properties update
    const properties: Record<string, any> = {};

    if (updates.status) {
      properties['Status'] = { status: { name: updates.status } };
    }
    if (updates.title) {
      properties['Name'] = { title: [{ text: { content: updates.title } }] };
    }
    if (updates.dueDate) {
      properties['Due Date'] = { date: { start: updates.dueDate } };
    }

    if (Object.keys(properties).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    // Update Notion page
    const response = await fetch(`https://api.notion.com/v1/pages/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Notion update error:', error);
      return NextResponse.json({ error: 'Failed to update task in Notion' }, { status: 500 });
    }

    return NextResponse.json({ success: true, taskId, updates });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

/**
 * Get the Tasks database ID from the Contracts database schema
 */
async function getTasksDatabaseId(): Promise<string | null> {
  if (TASKS_DATABASE_ID) return TASKS_DATABASE_ID;

  try {
    const response = await fetch(
      `https://api.notion.com/v1/databases/${DATABASE_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const tasksRelation = data.properties?.Tasks?.relation;

    if (tasksRelation?.database_id) {
      TASKS_DATABASE_ID = tasksRelation.database_id;
      return TASKS_DATABASE_ID;
    }
  } catch (err) {
    console.error('Error getting Tasks database ID:', err);
  }

  return null;
}

/**
 * POST - Create a new task in Notion and link it to a contract
 * Body: { contractName: string, title: string, dueDate?: string, priority?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { contractName, title, dueDate, priority } = await request.json();

    if (!contractName || !title) {
      return NextResponse.json({ error: 'contractName and title are required' }, { status: 400 });
    }

    // Find the contract in Notion
    const searchResponse = await fetch(
      `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: {
            property: 'Name',
            title: { equals: contractName }
          },
          page_size: 1,
        }),
      }
    );

    if (!searchResponse.ok) {
      console.error('Notion search error:', await searchResponse.text());
      return NextResponse.json({ error: 'Failed to find contract' }, { status: 500 });
    }

    const searchData = await searchResponse.json();

    if (searchData.results.length === 0) {
      return NextResponse.json({ error: 'Contract not found in Notion' }, { status: 404 });
    }

    const contractPage = searchData.results[0];
    const contractId = contractPage.id;

    // Get the Tasks database ID
    const tasksDatabaseId = await getTasksDatabaseId();

    if (!tasksDatabaseId) {
      return NextResponse.json({
        error: 'Tasks database not found. Make sure the Contracts database has a "Tasks" relation property.'
      }, { status: 500 });
    }

    // Build task properties
    const properties: Record<string, any> = {
      // Task name - try common property names
      'Name': { title: [{ text: { content: title } }] },
      'Status': { status: { name: 'To Do' } },
    };

    if (dueDate) {
      properties['Due Date'] = { date: { start: dueDate } };
    }

    if (priority) {
      properties['Priority'] = { select: { name: priority } };
    }

    // Add relation to contract - property name might be "Contract" or "Contracts"
    properties['Contract'] = { relation: [{ id: contractId }] };

    // Create the task in Notion
    const createResponse = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: tasksDatabaseId },
        properties,
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Notion create error:', errorText);

      // Try without the Contract relation (it might have a different name)
      delete properties['Contract'];
      properties['Contracts'] = { relation: [{ id: contractId }] };

      const retryResponse = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent: { database_id: tasksDatabaseId },
          properties,
        }),
      });

      if (!retryResponse.ok) {
        // Try without any relation - just create the task
        delete properties['Contracts'];

        const finalResponse = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            parent: { database_id: tasksDatabaseId },
            properties,
          }),
        });

        if (!finalResponse.ok) {
          return NextResponse.json({ error: 'Failed to create task in Notion' }, { status: 500 });
        }

        const taskData = await finalResponse.json();
        return NextResponse.json({
          success: true,
          taskId: taskData.id,
          warning: 'Task created but not linked to contract (relation property not found)',
          title,
        });
      }

      const taskData = await retryResponse.json();
      return NextResponse.json({ success: true, taskId: taskData.id, title });
    }

    const taskData = await createResponse.json();
    return NextResponse.json({ success: true, taskId: taskData.id, title });

  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
