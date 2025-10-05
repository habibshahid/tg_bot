	<div class="bg-light border-right" id="sidebar-wrapper">
      <div class="sidebar-heading"><b>Switch Board</b> </div>
      <div class="list-group list-group-flush">
        <a href="<?php echo base_url()?>gateways" class="list-group-item list-group-item-action <?php if($menu == 'gateways'){echo 'active';}else{echo 'bg-light';} ?>">Gateways</a>
		<a href="<?php echo base_url()?>agents" class="list-group-item list-group-item-action <?php if($menu == 'agents'){echo 'active';}else{echo 'bg-light';} ?>">Agents</a>
		<a href="<?php echo base_url()?>users" class="list-group-item list-group-item-action <?php if($menu == 'users'){echo 'active';}else{echo 'bg-light';} ?>">Users</a>
		<!--<a href="<?php //echo base_url()?>ivrs" class="list-group-item list-group-item-action <?php //if($menu == 'ivrs'){echo 'active';}else{echo 'bg-light';} ?>">IVRs</a>
		<a href="<?php //echo base_url()?>lists" class="list-group-item list-group-item-action <?php //if($menu == 'lists'){echo 'active';}else{echo 'bg-light';} ?>">Destination Lists</a>-->
		<a href="<?php echo base_url()?>clients" class="list-group-item list-group-item-action <?php if($menu == 'clients'){echo 'active';}else{echo 'bg-light';} ?>">Clients</a>
		<a href="<?php echo base_url()?>providers" class="list-group-item list-group-item-action <?php if($menu == 'providers'){echo 'active';}else{echo 'bg-light';} ?>">Providers</a>
		<a href="<?php echo base_url()?>rate_cards" class="list-group-item list-group-item-action <?php if($menu == 'rate_cards'){echo 'active';}else{echo 'bg-light';} ?>">Rate Cards</a>
		<a href="<?php echo base_url()?>rates" class="list-group-item list-group-item-action <?php if($menu == 'rates'){echo 'active';}else{echo 'bg-light';} ?>">Rates</a>
      </div>
    </div>