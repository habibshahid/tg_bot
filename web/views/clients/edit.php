<?php $this->load->view('templates/header'); ?>

<body>

  <div class="d-flex" id="wrapper">

    <!-- Sidebar -->
    <?php $this->load->view('templates/navbar'); ?>
    <!-- /#sidebar-wrapper -->

    <!-- Page Content -->
    <div id="page-content-wrapper">
	  <?php $this->load->view('templates/top_nav'); ?>
      

      <div class="container-fluid">
        <h3 class="mt-4">Edit User - <?php echo $fields->first_name . ' ' . $fields->last_name . '(' . $fields->telegram_id . ')'; ?></h3>
		<nav aria-label="breadcrumb">
			<ol class="breadcrumb">
				<li class="breadcrumb-item"><a href="<?php echo base_url(); ?>clients">Clients</a></li>
				<li class="breadcrumb-item active">Edit User</li>
			</ol>
		</nav>
		<h6 class="mt-4"><?php echo $this->session->flashdata('message');?></h6>
		
		<?php $attributes = array('class'=>'form-signin');
		echo form_open("clients/edit/".$fields->id,$attributes);?>
		<input type="hidden" name="user_id" value="<?php echo $fields->id; ?>">
		
			<!-- User Information Card -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Basic Information</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Username <span class="text-danger">*</span></label>
							<input class="form-control" id="username" name="username" placeholder="Enter Username" value="<?php echo set_value('username', $fields->username); ?>" required />
						</div>
						<div class="form-group col-md-6">
							<label>Email</label>
							<input class="form-control" id="email" name="email" type="email" placeholder="Enter Email" value="<?php echo set_value('email', $fields->email); ?>" />
						</div>
					</div>
					<div class="row">
						<div class="form-group col-md-6">
							<label>First Name <span class="text-danger">*</span></label>
							<input class="form-control" id="first_name" name="first_name" placeholder="Enter First Name" value="<?php echo set_value('first_name', $fields->first_name); ?>" required />
						</div>
						<div class="form-group col-md-6">
							<label>Last Name <span class="text-danger">*</span></label>
							<input class="form-control" id="last_name" name="last_name" placeholder="Enter Last Name" value="<?php echo set_value('last_name', $fields->last_name); ?>" required />
						</div>
					</div>
					<div class="row">
						<div class="form-group col-md-6">
							<label>Password</label>
							<input class="form-control" id="password" name="password" type="password" placeholder="Leave blank to keep current password" />
							<small class="form-text text-muted">Leave blank to keep current password. Minimum 6 characters if changing.</small>
						</div>
						<div class="form-group col-md-6">
							<label>Telegram ID</label>
							<input class="form-control" id="telegram_id" name="telegram_id" placeholder="Enter Telegram ID" value="<?php echo set_value('telegram_id', $fields->telegram_id); ?>" />
						</div>
					</div>
				</div>
			</div>
			<div class="card mb-4">
				<div class="card-header">
					<h5>Destination Configuration</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Destination Type</label>
							<select class="form-control" id="destination_type" name="destination_type">
								<option value="">Select Destination Type</option>
								<?php
								$current_type = '';
								if($fields->destination_route) {
									$current_type = (strpos($fields->destination_route, 'trunk/') === 0) ? 'trunk' : 'agent';
								}
								?>
								<option value="trunk" <?php echo set_select('destination_type', 'trunk', ($current_type == 'trunk')); ?>>SIP Trunk</option>
								<option value="agent" <?php echo set_select('destination_type', 'agent', ($current_type == 'agent')); ?>>Agent/Extension</option>
							</select>
							<small class="form-text text-muted">Choose whether calls route through SIP trunk or dedicated agent</small>
						</div>
					</div>
					
					<?php if($fields->destination_route): ?>
					<div class="alert alert-info">
						<strong>Current Destination Route:</strong> <?php echo $fields->destination_route; ?>
						<?php if($fields->assigned_agent_name): ?>
						<br><strong>Assigned Agent:</strong> <?php echo $fields->assigned_agent_name; ?> (<?php echo $fields->assigned_agent_extension; ?>)
						<?php endif; ?>
					</div>
					<?php endif; ?>
					
					<!-- Trunk Selection -->
					<div id="trunk_selection" style="display: <?php echo ($current_type == 'trunk') ? 'block' : 'none'; ?>;">
						<div class="row">
							<div class="form-group col-md-6">
								<label>Select SIP Trunk</label>
								<select class="form-control" id="destination_trunk" name="destination_trunk">
									<option value="">Select SIP Trunk</option>
									<?php 
									$selected_trunk = '';
									if($fields->destination_route && strpos($fields->destination_route, 'trunk/') === 0) {
										$selected_trunk = str_replace('trunk/', '', $fields->destination_route);
									}
									foreach($user_trunks as $sip_trunk): 
									?>
									<option value="<?php echo $sip_trunk->name; ?>" <?php echo ($selected_trunk == $sip_trunk->name) ? 'selected' : ''; ?>>
										<?php echo $sip_trunk->name . ' (' . $sip_trunk->host . ')'; ?>
									</option>
									<?php endforeach; ?>
								</select>
							</div>
						</div>
					</div>
					
					<!-- Agent Selection -->
					<div id="agent_selection" style="display: <?php echo ($current_type == 'agent') ? 'block' : 'none'; ?>;">
						<div class="row">
							<div class="form-group col-md-8">
								<label>Select Agent/Extension</label>
								<select class="form-control" id="destination_agent" name="destination_agent">
									<option value="">Select Agent</option>
									<?php 
									$selected_agent_id = null;
									if($fields->destination_route && strpos($fields->destination_route, 'agent/') === 0) {
										$agent_name = str_replace('agent/', '', $fields->destination_route);
										foreach($user_agents as $agent) {
											if($agent->name == $agent_name) {
												$selected_agent_id = $agent->name;
												break;
											}
										}
									}
									foreach($user_agents as $agent): 
									?>
									<option value="<?php echo $agent->name; ?>" <?php echo ($selected_agent_id == $agent->name) ? 'selected' : ''; ?>>
										<?php echo $agent->name . ' (' . ($agent->defaultuser ?: $agent->username) . ')'; ?>
									</option>
									<?php endforeach; ?>
								</select>
								<small class="form-text text-muted">Only agents associated with this user are shown</small>
							</div>
							<div class="form-group col-md-4">
								<label>&nbsp;</label><br>
								<a href="<?php echo base_url(); ?>clients/manage_agents/<?php echo $fields->id; ?>" 
								   class="btn btn-info btn-sm">
									<i class="fas fa-cogs"></i> Manage Agent Pool
								</a>
							</div>
						</div>
					</div>
					
					
				</div>
			</div>
			<!-- Account Settings Card -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Account Settings</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>User Type</label>
							<select class="form-control" id="user_type" name="user_type" required>
								<option value="user" <?php echo set_select('user_type', 'user', ($fields->user_type == 'user')); ?>>User</option>
								<option value="admin" <?php echo set_select('user_type', 'admin', ($fields->user_type == 'admin')); ?>>Admin</option>
							</select>
						</div>
						<div class="form-group col-md-6">
							<label>Status</label>
							<select class="form-control" id="status" name="status" required>
								<option value="active" <?php echo set_select('status', 'active', ($fields->status == 'active')); ?>>Active</option>
								<option value="suspended" <?php echo set_select('status', 'suspended', ($fields->status == 'suspended')); ?>>Suspended</option>
								<option value="inactive" <?php echo set_select('status', 'inactive', ($fields->status == 'inactive')); ?>>Inactive</option>
							</select>
						</div>
					</div>
					<div class="row">
						<div class="form-group col-md-6">
							<label>Credit Limit</label>
							<input class="form-control" id="credit_limit" name="credit_limit" type="number" step="0.0001" placeholder="0.0000" value="<?php echo set_value('credit_limit', $fields->credit_limit); ?>" />
							<small class="form-text text-muted">Maximum credit limit for this user</small>
						</div>
						<div class="form-group col-md-6">
							<label>Rate Card</label>
							<select class="form-control" id="rate_card_id" name="rate_card_id">
								<option value="">Select Rate Card</option>
								<?php foreach($rate_cards as $rate_card): ?>
								<option value="<?php echo $rate_card->id; ?>" <?php echo set_select('rate_card_id', $rate_card->id, ($fields->rate_card_id == $rate_card->id)); ?>>
									<?php echo $rate_card->name . ' (' . $rate_card->currency . ')'; ?>
								</option>
								<?php endforeach; ?>
							</select>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Preferences Card -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Preferences</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Timezone</label>
							<select class="form-control" id="timezone" name="timezone">
								<option value="UTC" <?php echo set_select('timezone', 'UTC', ($fields->timezone == 'UTC')); ?>>UTC</option>
								<option value="America/New_York" <?php echo set_select('timezone', 'America/New_York', ($fields->timezone == 'America/New_York')); ?>>Eastern Time</option>
								<option value="America/Chicago" <?php echo set_select('timezone', 'America/Chicago', ($fields->timezone == 'America/Chicago')); ?>>Central Time</option>
								<option value="America/Denver" <?php echo set_select('timezone', 'America/Denver', ($fields->timezone == 'America/Denver')); ?>>Mountain Time</option>
								<option value="America/Los_Angeles" <?php echo set_select('timezone', 'America/Los_Angeles', ($fields->timezone == 'America/Los_Angeles')); ?>>Pacific Time</option>
								<option value="Europe/London" <?php echo set_select('timezone', 'Europe/London', ($fields->timezone == 'Europe/London')); ?>>London</option>
								<option value="Europe/Paris" <?php echo set_select('timezone', 'Europe/Paris', ($fields->timezone == 'Europe/Paris')); ?>>Paris</option>
								<option value="Asia/Dubai" <?php echo set_select('timezone', 'Asia/Dubai', ($fields->timezone == 'Asia/Dubai')); ?>>Dubai</option>
								<option value="Asia/Karachi" <?php echo set_select('timezone', 'Asia/Karachi', ($fields->timezone == 'Asia/Karachi')); ?>>Karachi</option>
								<option value="Asia/Tokyo" <?php echo set_select('timezone', 'Asia/Tokyo', ($fields->timezone == 'Asia/Tokyo')); ?>>Tokyo</option>
							</select>
						</div>
						<div class="form-group col-md-6">
							<label>Currency</label>
							<select class="form-control" id="currency" name="currency">
								<option value="USD" <?php echo set_select('currency', 'USD', ($fields->currency == 'USD')); ?>>USD</option>
								<option value="EUR" <?php echo set_select('currency', 'EUR', ($fields->currency == 'EUR')); ?>>EUR</option>
								<option value="GBP" <?php echo set_select('currency', 'GBP', ($fields->currency == 'GBP')); ?>>GBP</option>
								<option value="PKR" <?php echo set_select('currency', 'PKR', ($fields->currency == 'PKR')); ?>>PKR</option>
								<option value="AED" <?php echo set_select('currency', 'AED', ($fields->currency == 'AED')); ?>>AED</option>
							</select>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Current Balance Information -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Current Account Status</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="col-md-3">
							<div class="card bg-primary text-white">
								<div class="card-body text-center">
									<h4>$<?php echo number_format($fields->balance, 4); ?></h4>
									<p>Current Balance</p>
								</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="card bg-info text-white">
								<div class="card-body text-center">
									<h4>$<?php echo number_format($fields->credit_limit, 4); ?></h4>
									<p>Credit Limit</p>
								</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="card bg-success text-white">
								<div class="card-body text-center">
									<h4><?php echo $fields->rate_card_name ?: 'None'; ?></h4>
									<p>Rate Card</p>
								</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="card bg-warning text-white">
								<div class="card-body text-center">
									<h4><?php echo ucfirst($fields->status); ?></h4>
									<p>Status</p>
								</div>
							</div>
						</div>
					</div>
					<div class="row mt-3">
						<div class="col-md-12">
							<p><strong>Created:</strong> <?php echo date('Y-m-d H:i:s', strtotime($fields->created_at)); ?></p>
							<p><strong>Last Updated:</strong> <?php echo date('Y-m-d H:i:s', strtotime($fields->updated_at)); ?></p>
							<?php if($fields->last_login_at): ?>
							<p><strong>Last Login:</strong> <?php echo date('Y-m-d H:i:s', strtotime($fields->last_login_at)); ?></p>
							<?php endif; ?>
						</div>
					</div>
				</div>
			</div>
			
			<hr>
			<div class="row">
				<div class="col-md-12">
					<button type="submit" class="btn btn-success btn-sm">Update User</button>
					<a href="<?php echo base_url();?>clients/credit_management/<?php echo $fields->id; ?>" class="btn btn-info btn-sm">Manage Credit</a>
					<a href="<?php echo base_url();?>clients/assign_rate_card/<?php echo $fields->id; ?>" class="btn btn-primary btn-sm">Assign Rate Card</a>
					<a href="<?php echo base_url();?>clients" class="btn btn-warning btn-sm">Cancel</a>
				</div>
			</div>
			<br><br><br><br>
		<?php echo form_close();?>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

  <?php $this->load->view('templates/footer'); ?>
  
  <script>
	
$(document).ready(function(){
    // Handle destination type change
    $('#destination_type').change(function(){
        var type = $(this).val();
        
        if(type == 'trunk') {
            $('#trunk_selection').show();
            $('#agent_selection').hide();
            $('#destination_trunk').attr('required', true);
            $('#destination_agent').attr('required', false);
        } else if(type == 'agent') {
            $('#trunk_selection').hide();
            $('#agent_selection').show();
            $('#destination_trunk').attr('required', false);
            $('#destination_agent').attr('required', true);
            
            // Load available agents
            //loadAvailableAgents();
        } else {
            $('#trunk_selection').hide();
            $('#agent_selection').hide();
            $('#destination_trunk').attr('required', false);
            $('#destination_agent').attr('required', false);
        }
    });
    
    // Initialize based on current selection (for edit form)
    var currentType = $('#destination_type').val();
    if(currentType) {
        $('#destination_type').trigger('change');
    }
    
    // Load available agents
    function loadAvailableAgents() {
        $.ajax({
            url: '<?php echo base_url(); ?>clients/get_available_agents',
            type: 'POST',
            dataType: 'json',
            success: function(response) {
                if(response.success) {
                    var options = '<option value="">Select Agent</option>';
                    $.each(response.agents, function(index, agent) {
                        var selected = '';
                        <?php if(isset($fields) && $fields->assigned_agent_id): ?>
                        if(agent.id == '<?php echo $fields->assigned_agent_id; ?>') {
                            selected = 'selected';
                        }
                        <?php endif; ?>
                        
                        options += '<option value="' + agent.id + '" ' + selected + '>' + 
                                   agent.name + ' (' + (agent.defaultuser || agent.username) + ')' + 
                                   '</option>';
                    });
                    $('#destination_agent').html(options);
                }
            },
            error: function() {
                alert('Error loading agents');
            }
        });
    }
});
</script>

</body>

</html